import { pushSchema } from "drizzle-kit/api";
import { eq, isNull, sql } from "drizzle-orm";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { withReplicas } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import postgres from "postgres";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import * as schema from "@/shared-backend/schema.js";
import {
    organizationMembershipAllProjectCapabilityTable,
    organizationMembershipTable,
    organizationTable,
    projectContentTable,
    projectDocumentFileTable,
    projectDocumentRepresentationTable,
    projectDocumentTable,
    projectTable,
    projectOrganizationOwnershipTable,
    userTable,
} from "@/shared-backend/schema.js";
import {
    accessProjectDocument,
    deleteProjectDocument,
    uploadProjectDocument,
} from "./projectDocument.js";
import { normalizeProjectDocumentUploadFile } from "./projectDocumentFile.js";
import {
    backfillProjectDocumentRepresentations,
    cleanupProjectDocumentRepresentations,
    publishProjectDocumentRepresentations,
} from "./projectDocumentStorage.js";
import type {
    deleteFromS3,
    downloadFromS3,
    generatePresignedUrl,
    uploadToS3,
} from "./s3.js";

const mocks = vi.hoisted(() => ({
    upload: vi.fn<typeof uploadToS3>(),
    download: vi.fn<typeof downloadFromS3>(),
    delete: vi.fn<typeof deleteFromS3>(),
    sign: vi.fn<typeof generatePresignedUrl>(),
}));
vi.mock("./s3.js", () => ({
    uploadToS3: mocks.upload,
    downloadFromS3: mocks.download,
    deleteFromS3: mocks.delete,
    generatePresignedUrl: mocks.sign,
}));
vi.mock("@/app.js", () => ({
    config: {
        PROJECT_DOCUMENTS_AWS_S3_BUCKET_NAME: "documents",
        PROJECT_DOCUMENTS_AWS_S3_REGION: "eu-west-1",
        PROJECT_DOCUMENTS_S3_PRESIGNED_URL_EXPIRY_SECONDS: 600,
    },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ownerId = "00000000-0000-4000-8000-000000000001";
const storage = { bucketName: "documents", region: "eu-west-1" };
const metadata = {
    projectSlug: "test-project",
    defaultLanguageCode: "en",
    localizations: [
        { languageCode: "en", name: "Report", downloadFileName: "report.html" },
    ],
} satisfies Parameters<typeof uploadProjectDocument>[0]["metadata"];
const input = {
    originalFileName: "report.html",
    reportedContentType: "text/html",
    buffer: Buffer.from(
        `<!doctype html><html><body><script type="application/json" id="data">${JSON.stringify(Array.from({ length: 1000 }, () => ({ title: "Community report", votes: 42 })))}</script><script>document.body.dataset.ready=JSON.parse(document.getElementById('data').textContent).length</script></body></html>`,
    ),
};

function first<T>(rows: T[]): T {
    const row = rows.at(0);
    if (row === undefined) throw new Error("Missing test row");
    return row;
}

function createGate() {
    let release: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
        release = resolve;
    });
    return { promise, release };
}

describe("project document representation lifecycle", () => {
    let container: StartedTestContainer;
    let client: postgres.Sql;
    let db: PostgresJsDatabase;
    let projectId: number;
    const containers: StartedTestContainer[] = [];
    const clients: postgres.Sql[] = [];
    const objects = new Map<
        string,
        { buffer: Buffer; encoding: "gzip" | "br" | undefined }
    >();

    beforeAll(async () => {
        container = await new GenericContainer("postgres:16-alpine")
            .withEnvironment({
                POSTGRES_USER: "postgres",
                POSTGRES_PASSWORD: "postgres",
                POSTGRES_DB: "documents_test",
            })
            .withExposedPorts(5432)
            .start();
        containers.push(container);
        const connection = {
            host: container.getHost(),
            port: container.getMappedPort(5432),
            database: "documents_test",
            user: "postgres",
            password: "postgres",
        };
        client = postgres({
            ...connection,
            username: connection.user,
            onnotice: () => undefined,
        });
        clients.push(client);
        db = drizzle(client);
        const pool = new Pool(connection);
        try {
            // Test-only schema in a disposable container; no migration files.
            const setup = await pushSchema(schema, drizzleNodePostgres(pool));
            await setup.apply();
        } finally {
            await pool.end();
        }
    }, 120_000);

    afterAll(async () => {
        for (const resource of clients) await resource.end({ timeout: 5 });
        for (const resource of containers) await resource.stop();
    }, 120_000);

    afterEach(() => vi.restoreAllMocks());

    beforeEach(async () => {
        await db.execute(sql`TRUNCATE project_document_representation, project_document_file,
            project_document_localization, project_document, project, "user" RESTART IDENTITY CASCADE`);
        objects.clear();
        for (const mock of Object.values(mocks)) mock.mockReset();
        mocks.upload.mockImplementation(
            ({ s3Key, buffer, contentEncoding }) => {
                objects.set(s3Key, { buffer, encoding: contentEncoding });
                return Promise.resolve();
            },
        );
        mocks.delete.mockImplementation(({ s3Key }) => {
            objects.delete(s3Key);
            return Promise.resolve();
        });
        mocks.download.mockImplementation(({ s3Key }) => {
            const object = objects.get(s3Key);
            if (object === undefined) throw new Error("Missing test object");
            return Promise.resolve(object.buffer);
        });
        mocks.sign.mockImplementation(({ s3Key }) =>
            Promise.resolve({
                url: `https://documents.example/${s3Key}`,
                expiresAt: new Date("2099-01-01"),
            }),
        );
        await db.insert(userTable).values({ id: ownerId, username: "owner" });
        const project = first(
            await db
                .insert(projectTable)
                .values({
                    slug: metadata.projectSlug,
                    title: "Test",
                    directoryVisibility: "listed",
                })
                .returning(),
        );
        projectId = project.id;
        const content = first(
            await db
                .insert(projectContentTable)
                .values({ projectId, title: "Test" })
                .returning(),
        );
        await db
            .update(projectTable)
            .set({ currentContentId: content.id })
            .where(eq(projectTable.id, projectId));
    });

    async function upload() {
        return await uploadProjectDocument({
            db,
            metadata,
            participantFile: input,
            ownerFile: undefined,
            createdByUserId: ownerId,
        });
    }

    async function resetCompression() {
        await db
            .update(projectDocumentRepresentationTable)
            .set({ deletedAt: new Date() });
    }

    async function access({
        documentId,
        encodings = ["br", "gzip", "identity"],
    }: {
        documentId: string;
        encodings?: ("br" | "gzip" | "identity")[];
    }) {
        return await accessProjectDocument({
            db,
            request: {
                projectSlug: metadata.projectSlug,
                documentId,
                audience: "participant",
                mode: "inline",
                languageCode: "en",
            },
            authorization: { type: "public" },
            acceptedEncodings: encodings,
        });
    }

    it("publishes identity and compressed objects once, preserving the security policy and logical size", async () => {
        const { document } = await upload();
        const files = await db.select().from(projectDocumentFileTable);
        const file = first(files);
        const representations = await db
            .select()
            .from(projectDocumentRepresentationTable);
        expect(representations).toHaveLength(2);
        expect(representations.every((row) => row.status === "available")).toBe(
            true,
        );
        expect(file.byteSize).toBe(
            normalizeProjectDocumentUploadFile(input).buffer.length,
        );
        expect(file.htmlScriptsEnabled).toBe(true);
        expect(objects.get(file.objectKey)?.buffer).toEqual(
            normalizeProjectDocumentUploadFile(input).buffer,
        );
        expect(document.participantFile.byteSize).toBe(file.byteSize);
        const response = await access({ documentId: document.documentId });
        const brotli = first(
            representations.filter((row) => row.encoding === "br"),
        );
        expect(response.url).toBe(
            `https://documents.example/${brotli.objectKey}`,
        );
        expect(response.htmlScriptsEnabled).toBe(true);
        expect(objects.get(brotli.objectKey)?.encoding).toBe("br");
        expect(mocks.upload).toHaveBeenCalledTimes(3);
    });

    it("issues 100 concurrent grants without recompression, body downloads, or additional S3 uploads", async () => {
        const { document } = await upload();
        mocks.upload.mockClear();
        const responses = await Promise.all(
            Array.from(
                { length: 100 },
                async () => await access({ documentId: document.documentId }),
            ),
        );
        expect(new Set(responses.map(({ url }) => url)).size).toBe(1);
        expect(mocks.sign).toHaveBeenCalledTimes(100);
        expect(mocks.upload).not.toHaveBeenCalled();
        expect(mocks.download).not.toHaveBeenCalled();
    });

    it("selects gzip/identity fallbacks and never signs an excluded encoding", async () => {
        const { document } = await upload();
        const file = first(await db.select().from(projectDocumentFileTable));
        const gzip = first(
            await db
                .select()
                .from(projectDocumentRepresentationTable)
                .where(eq(projectDocumentRepresentationTable.encoding, "gzip")),
        );
        expect(
            (
                await access({
                    documentId: document.documentId,
                    encodings: ["gzip", "identity"],
                })
            ).url,
        ).toBe(`https://documents.example/${gzip.objectKey}`);
        expect(
            (
                await access({
                    documentId: document.documentId,
                    encodings: ["identity"],
                })
            ).url,
        ).toBe(`https://documents.example/${file.objectKey}`);
        mocks.sign.mockClear();
        await expect(
            access({ documentId: document.documentId, encodings: [] }),
        ).rejects.toMatchObject({ statusCode: 406 });
        expect(mocks.sign).not.toHaveBeenCalled();
    });

    it("does not expose pending or deleted representations", async () => {
        const { document } = await upload();
        const file = first(await db.select().from(projectDocumentFileTable));
        await db
            .update(projectDocumentRepresentationTable)
            .set({ status: "pending" });
        expect((await access({ documentId: document.documentId })).url).toBe(
            `https://documents.example/${file.objectKey}`,
        );
        await db
            .update(projectDocumentRepresentationTable)
            .set({ status: "available", deletedAt: new Date() });
        expect((await access({ documentId: document.documentId })).url).toBe(
            `https://documents.example/${file.objectKey}`,
        );
    });

    it("rechecks project and audience authorization even when compressed objects exist", async () => {
        const { document } = await upload();
        await db
            .update(projectTable)
            .set({ directoryVisibility: "unlisted" })
            .where(eq(projectTable.id, projectId));
        await expect(
            access({ documentId: document.documentId }),
        ).rejects.toMatchObject({ statusCode: 404 });
        await db
            .update(projectTable)
            .set({ directoryVisibility: "listed" })
            .where(eq(projectTable.id, projectId));
        await expect(
            accessProjectDocument({
                db,
                request: {
                    projectSlug: metadata.projectSlug,
                    documentId: document.documentId,
                    audience: "owner",
                    mode: "inline",
                    languageCode: "en",
                },
                authorization: { type: "public" },
                acceptedEncodings: ["br", "identity"],
            }),
        ).rejects.toMatchObject({ statusCode: 403 });
        expect(mocks.sign).not.toHaveBeenCalled();
    });

    it("keeps compressed facilitator content separate and no-store", async () => {
        const organization = first(
            await db
                .insert(organizationTable)
                .values({
                    slug: "facilitators",
                    displayName: "Facilitators",
                    defaultLanguageCode: "en",
                    directoryVisibility: "listed",
                    isFullImagePath: false,
                })
                .returning(),
        );
        const membership = first(
            await db
                .insert(organizationMembershipTable)
                .values({
                    userId: ownerId,
                    organizationId: organization.id,
                })
                .returning(),
        );
        await db
            .insert(organizationMembershipAllProjectCapabilityTable)
            .values({
                organizationMembershipId: membership.id,
                capability: "project_update",
                grantedByUserId: ownerId,
            });
        await db
            .insert(projectOrganizationOwnershipTable)
            .values({ projectId, organizationId: organization.id });
        const { document } = await uploadProjectDocument({
            db,
            metadata,
            createdByUserId: ownerId,
            participantFile: input,
            ownerFile: {
                ...input,
                buffer: Buffer.from(
                    `<!doctype html><html><body>${"Restricted facilitator analysis ".repeat(2000)}</body></html>`,
                ),
            },
        });
        const owner = await accessProjectDocument({
            db,
            request: {
                projectSlug: metadata.projectSlug,
                documentId: document.documentId,
                audience: "owner",
                mode: "download",
                languageCode: "en",
            },
            authorization: { type: "facilitator", userId: ownerId },
            acceptedEncodings: ["br", "gzip", "identity"],
        });
        expect(owner.url).toContain("/owner/representations/");
        expect(owner.downloadFileName).toBe("report-internal-restricted.html");
        const grant = mocks.sign.mock.calls.at(-1)?.[0];
        expect(grant?.responseCacheControl).toBe("private, no-store");
        expect(grant?.responseContentDisposition).toContain("attachment;");
        const participant = await access({ documentId: document.documentId });
        expect(participant.url).toContain("/participant/representations/");
        expect(participant.url).not.toBe(owner.url);
        await db
            .update(organizationMembershipAllProjectCapabilityTable)
            .set({ deletedAt: new Date(), revokedByUserId: ownerId });
        mocks.sign.mockClear();
        await expect(
            accessProjectDocument({
                db,
                request: {
                    projectSlug: metadata.projectSlug,
                    documentId: document.documentId,
                    audience: "owner",
                    mode: "download",
                    languageCode: "en",
                },
                authorization: { type: "facilitator", userId: ownerId },
                acceptedEncodings: ["br", "gzip", "identity"],
            }),
        ).rejects.toMatchObject({ statusCode: 403 });
        expect(mocks.sign).not.toHaveBeenCalled();
    });

    it("reserves only one set under concurrent publishers", async () => {
        await upload();
        await resetCompression();
        mocks.upload.mockClear();
        const file = first(await db.select().from(projectDocumentFileTable));
        const buffer = normalizeProjectDocumentUploadFile(input).buffer;
        const results = await Promise.all(
            Array.from(
                { length: 6 },
                async () =>
                    await publishProjectDocumentRepresentations({
                        db,
                        file,
                        buffer,
                        storage,
                    }),
            ),
        );
        expect(results.reduce((sum, count) => sum + count, 0)).toBe(2);
        expect(mocks.upload).toHaveBeenCalledTimes(2);
    });

    it("cleans every representation and identity on document deletion", async () => {
        const { document } = await upload();
        await deleteProjectDocument({
            db,
            projectSlug: metadata.projectSlug,
            documentId: document.documentId,
        });
        expect(objects.size).toBe(0);
        const representations = await db
            .select()
            .from(projectDocumentRepresentationTable);
        expect(
            representations.every(
                (row) => row.deletedAt !== null && row.objectDeletedAt !== null,
            ),
        ).toBe(true);
    });

    it("does not race a live pending upload during cleanup, and does recover abandoned reservations", async () => {
        await upload();
        const rows = await db.select().from(projectDocumentRepresentationTable);
        await db
            .update(projectDocumentRepresentationTable)
            .set({ status: "pending", deletedAt: new Date() });
        mocks.delete.mockClear();
        await cleanupProjectDocumentRepresentations({
            db,
            storage,
            projectSlug: undefined,
            documentId: undefined,
        });
        expect(mocks.delete).not.toHaveBeenCalled();
        await db
            .update(projectDocumentRepresentationTable)
            .set({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
        await cleanupProjectDocumentRepresentations({
            db,
            storage,
            projectSlug: undefined,
            documentId: undefined,
        });
        expect(mocks.delete).toHaveBeenCalledTimes(rows.length);
    });

    it("coordinates cleanup on the writer instead of reading a lagging replica", async () => {
        await upload();
        await db
            .update(projectDocumentFileTable)
            .set({ deletedAt: new Date() });
        const replica = drizzle(client);
        const replicaRead = vi
            .spyOn(replica, "select")
            .mockImplementation(() => {
                throw new Error(
                    "Replica must not decide storage deletion eligibility",
                );
            });
        await cleanupProjectDocumentRepresentations({
            db: withReplicas(db, [replica]),
            storage,
            projectSlug: undefined,
            documentId: undefined,
        });
        expect(replicaRead).not.toHaveBeenCalled();
        const rows = await db.select().from(projectDocumentRepresentationTable);
        expect(rows.every((row) => row.objectDeletedAt !== null)).toBe(true);
    });

    it("never republishes reservations tombstoned by cleanup", async () => {
        await upload();
        await resetCompression();
        const file = first(await db.select().from(projectDocumentFileTable));
        mocks.upload.mockImplementation(
            async ({ s3Key, buffer, contentEncoding }) => {
                objects.set(s3Key, { buffer, encoding: contentEncoding });
                if (contentEncoding !== "gzip") return;
                await db
                    .update(projectDocumentRepresentationTable)
                    .set({
                        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
                    })
                    .where(
                        isNull(projectDocumentRepresentationTable.deletedAt),
                    );
                await cleanupProjectDocumentRepresentations({
                    db,
                    storage,
                    projectSlug: undefined,
                    documentId: undefined,
                });
            },
        );
        await expect(
            publishProjectDocumentRepresentations({
                db,
                file,
                storage,
                buffer: normalizeProjectDocumentUploadFile(input).buffer,
            }),
        ).rejects.toMatchObject({ statusCode: 409 });
        const rows = await db.select().from(projectDocumentRepresentationTable);
        expect(
            rows.every(
                (row) => row.deletedAt !== null && row.objectDeletedAt !== null,
            ),
        ).toBe(true);
        expect(
            first(await db.select().from(projectDocumentFileTable))
                .compressionSkippedAt,
        ).toBeNull();
        expect(objects.size).toBe(1);
    });

    it("uses one upload deadline and does not start another PUT after it expires", async () => {
        await upload();
        await resetCompression();
        const controller = new AbortController();
        vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
        const started = createGate();
        const finish = createGate();
        mocks.upload.mockClear();
        mocks.upload.mockImplementation(async () => {
            started.release();
            await finish.promise;
        });
        const file = first(await db.select().from(projectDocumentFileTable));
        const publication = publishProjectDocumentRepresentations({
            db,
            file,
            storage,
            buffer: normalizeProjectDocumentUploadFile(input).buffer,
        });
        // Attach before releasing the publisher to avoid an unhandled rejection.
        const rejected = expect(publication).rejects.toMatchObject({
            name: "AbortError",
        });
        try {
            await started.promise;
            controller.abort();
        } finally {
            finish.release();
        }
        await rejected;
        expect(mocks.upload).toHaveBeenCalledOnce();
        expect(mocks.upload).toHaveBeenCalledWith(
            expect.objectContaining({ abortSignal: controller.signal }),
        );
        const rows = await db
            .select()
            .from(projectDocumentRepresentationTable)
            .where(eq(projectDocumentRepresentationTable.status, "failed"));
        expect(rows).toHaveLength(2);
        expect(rows.every((row) => row.deletedAt !== null)).toBe(true);
    });

    it("checks elapsed time even if a suspended process has not run its abort timer", async () => {
        await upload();
        await resetCompression();
        const resumedAt = Date.now() + 3 * 60 * 1000;
        mocks.upload.mockClear();
        mocks.upload.mockImplementation(() => {
            vi.spyOn(Date, "now").mockReturnValue(resumedAt);
            return Promise.resolve();
        });
        const file = first(await db.select().from(projectDocumentFileTable));
        await expect(
            publishProjectDocumentRepresentations({
                db,
                file,
                storage,
                buffer: normalizeProjectDocumentUploadFile(input).buffer,
            }),
        ).rejects.toMatchObject({ name: "TimeoutError" });
        expect(mocks.upload).toHaveBeenCalledOnce();
        expect(
            first(await db.select().from(projectDocumentFileTable))
                .compressionSkippedAt,
        ).toBeNull();
    });

    it("rejects publication when the document is deleted during a PUT and cleans every derivative", async () => {
        const { document } = await upload();
        await resetCompression();
        const file = first(await db.select().from(projectDocumentFileTable));
        mocks.upload.mockImplementation(
            async ({ s3Key, buffer, contentEncoding }) => {
                objects.set(s3Key, { buffer, encoding: contentEncoding });
                if (contentEncoding === "br") {
                    await deleteProjectDocument({
                        db,
                        projectSlug: metadata.projectSlug,
                        documentId: document.documentId,
                    });
                }
            },
        );
        await expect(
            publishProjectDocumentRepresentations({
                db,
                file,
                storage,
                buffer: normalizeProjectDocumentUploadFile(input).buffer,
            }),
        ).rejects.toMatchObject({ statusCode: 404 });
        await cleanupProjectDocumentRepresentations({
            db,
            storage,
            projectSlug: undefined,
            documentId: undefined,
        });
        expect(objects.size).toBe(0);
        await expect(
            access({ documentId: document.documentId }),
        ).rejects.toMatchObject({ statusCode: 404 });
        expect(mocks.sign).not.toHaveBeenCalled();
    });

    it("waits for all object deletions even when one fails, and safely retries", async () => {
        await upload();
        await resetCompression();
        const started = createGate();
        const finish = createGate();
        mocks.delete.mockImplementation(async ({ s3Key }) => {
            if (s3Key.endsWith("/br"))
                throw new Error("Simulated delete outage");
            started.release();
            await finish.promise;
            objects.delete(s3Key);
        });
        let settled = false;
        const cleanup = cleanupProjectDocumentRepresentations({
            db,
            storage,
            projectSlug: undefined,
            documentId: undefined,
        });
        const checked = (async () => {
            try {
                await expect(cleanup).rejects.toThrow(
                    "Simulated delete outage",
                );
            } finally {
                settled = true;
            }
        })();
        try {
            await started.promise;
            expect(settled).toBe(false);
        } finally {
            finish.release();
        }
        await checked;
        mocks.delete.mockImplementation(({ s3Key }) => {
            objects.delete(s3Key);
            return Promise.resolve();
        });
        await cleanupProjectDocumentRepresentations({
            db,
            storage,
            projectSlug: undefined,
            documentId: undefined,
        });
        expect(objects.size).toBe(1);
        const rows = await db.select().from(projectDocumentRepresentationTable);
        expect(rows.every((row) => row.objectDeletedAt !== null)).toBe(true);
    });

    it("marks incompressible files complete so they do not starve later backfill batches", async () => {
        await upload();
        await resetCompression();
        await cleanupProjectDocumentRepresentations({
            db,
            storage,
            projectSlug: undefined,
            documentId: undefined,
        });
        const buffer = randomBytes(8192);
        const file = first(
            await db
                .update(projectDocumentFileTable)
                .set({
                    byteSize: buffer.length,
                    contentType: "text/plain",
                    htmlScriptsEnabled: false,
                })
                .returning(),
        );
        objects.set(file.objectKey, { buffer, encoding: undefined });
        const args = {
            db,
            storage,
            projectSlug: metadata.projectSlug,
            documentId: undefined,
            limit: 1,
            apply: true,
        };
        expect(await backfillProjectDocumentRepresentations(args)).toEqual({
            selected: 1,
            prepared: 0,
        });
        expect(
            first(await db.select().from(projectDocumentFileTable))
                .compressionSkippedAt,
        ).not.toBeNull();
        expect(await backfillProjectDocumentRepresentations(args)).toEqual({
            selected: 0,
            prepared: 0,
        });
        await upload();
        await db
            .update(projectDocumentRepresentationTable)
            .set({ deletedAt: new Date() });
        expect(await backfillProjectDocumentRepresentations(args)).toEqual({
            selected: 1,
            prepared: 1,
        });
    });

    it("keeps the legacy file and script policy unchanged during dry-run, backfill and retry", async () => {
        const { document } = await upload();
        await resetCompression();
        await db
            .update(projectDocumentFileTable)
            .set({ htmlScriptsEnabled: false });
        mocks.upload.mockClear();
        const args = {
            db,
            storage,
            projectSlug: metadata.projectSlug,
            documentId: document.documentId,
            limit: 100,
        };
        expect(
            await backfillProjectDocumentRepresentations({
                ...args,
                apply: false,
            }),
        ).toEqual({ selected: 1, prepared: 0 });
        expect(mocks.download).not.toHaveBeenCalled();
        const file = first(await db.select().from(projectDocumentFileTable));
        const identity = objects.get(file.objectKey);
        expect(
            await backfillProjectDocumentRepresentations({
                ...args,
                apply: true,
            }),
        ).toEqual({ selected: 1, prepared: 1 });
        expect(objects.get(file.objectKey)).toBe(identity);
        expect(
            (await access({ documentId: document.documentId }))
                .htmlScriptsEnabled,
        ).toBe(false);
        mocks.upload.mockClear();
        expect(
            await backfillProjectDocumentRepresentations({
                ...args,
                apply: true,
            }),
        ).toEqual({ selected: 0, prepared: 0 });
        expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("leaves existing files readable if compressed publication fails", async () => {
        const { document } = await upload();
        await resetCompression();
        const file = first(await db.select().from(projectDocumentFileTable));
        mocks.upload.mockRejectedValueOnce(
            new Error("Simulated storage outage"),
        );
        await expect(
            publishProjectDocumentRepresentations({
                db,
                file,
                storage,
                buffer: normalizeProjectDocumentUploadFile(input).buffer,
            }),
        ).rejects.toThrow("Simulated storage outage");
        expect((await access({ documentId: document.documentId })).url).toBe(
            `https://documents.example/${file.objectKey}`,
        );
        expect(objects.has(file.objectKey)).toBe(true);
    });

    it("does not publish a new document when a compressed object upload fails", async () => {
        const originalUpload = mocks.upload.getMockImplementation();
        mocks.upload.mockImplementation(async (request) => {
            if (request.contentEncoding !== undefined)
                throw new Error("Simulated storage outage");
            await originalUpload?.(request);
        });
        await expect(upload()).rejects.toThrow("Simulated storage outage");
        const document = first(await db.select().from(projectDocumentTable));
        expect(document.publishedAt).toBeNull();
        expect(document.deletedAt).not.toBeNull();
        expect(objects.size).toBe(0);
        const representations = await db
            .select()
            .from(projectDocumentRepresentationTable);
        expect(
            representations.every(
                (row) => row.deletedAt !== null && row.objectDeletedAt !== null,
            ),
        ).toBe(true);
    });

    it("enforces positive sizes and one active representation per encoding in the database", async () => {
        await upload();
        const row = first(
            await db.select().from(projectDocumentRepresentationTable),
        );
        await expect(
            db.insert(projectDocumentRepresentationTable).values({
                fileId: row.fileId,
                encoding: row.encoding,
                objectKey: "invalid-size",
                byteSize: 0,
                checksumSha256: row.checksumSha256,
            }),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
        await expect(
            db.insert(projectDocumentRepresentationTable).values({
                fileId: row.fileId,
                encoding: row.encoding,
                objectKey: "duplicate-encoding",
                byteSize: row.byteSize,
                checksumSha256: row.checksumSha256,
            }),
        ).rejects.toMatchObject({ cause: { code: "23505" } });
        await expect(
            db.insert(projectDocumentRepresentationTable).values({
                fileId: row.fileId,
                encoding: row.encoding,
                objectKey: "failed-without-tombstone",
                status: "failed",
                byteSize: row.byteSize,
                checksumSha256: row.checksumSha256,
            }),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
        await expect(
            db.insert(projectDocumentRepresentationTable).values({
                fileId: row.fileId,
                encoding: row.encoding,
                objectKey: "deleted-without-tombstone",
                objectDeletedAt: new Date(),
                byteSize: row.byteSize,
                checksumSha256: row.checksumSha256,
            }),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
    });
});
