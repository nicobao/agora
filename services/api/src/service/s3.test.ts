import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadToS3 } from "./s3.js";

vi.mock("@/app.js", () => ({
    config: { EXPORT_CONVOS_AWS_S3_REGION: "eu-west-1" },
    log: { info: vi.fn(), error: vi.fn() },
}));

afterEach(() => vi.restoreAllMocks());

describe("S3 HTTP representation metadata", () => {
    it("declares the encoding for the exact uploaded bytes without changing MIME type", async () => {
        const send = vi
            .spyOn(S3Client.prototype, "send")
            .mockResolvedValue(undefined);
        const buffer = Buffer.from("encoded fixture");
        const abortSignal = AbortSignal.timeout(120_000);
        await uploadToS3({
            s3Key: "report/br",
            bucketName: "documents",
            region: "eu-west-1",
            buffer,
            contentType: "text/html",
            contentEncoding: "br",
            checksumSha256: "fixture-checksum",
            abortSignal,
        });
        const command = send.mock.calls.at(0)?.at(0);
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect(send.mock.calls.at(0)?.at(1)).toEqual({ abortSignal });
        if (command instanceof PutObjectCommand) {
            expect(command.input).toMatchObject({
                Key: "report/br",
                Bucket: "documents",
                Body: buffer,
                ContentEncoding: "br",
                ContentType: "text/html",
                ChecksumSHA256: "fixture-checksum",
            });
        }
    });

    it("leaves ordinary CSV exports unencoded", async () => {
        const send = vi
            .spyOn(S3Client.prototype, "send")
            .mockResolvedValue(undefined);
        await uploadToS3({
            s3Key: "export.csv",
            bucketName: "exports",
            buffer: Buffer.from("statement,votes\n"),
            fileName: "export.csv",
        });
        const command = send.mock.calls.at(0)?.at(0);
        expect(command).toBeInstanceOf(PutObjectCommand);
        if (command instanceof PutObjectCommand) {
            expect(command.input.ContentEncoding).toBeUndefined();
            expect(command.input.ContentType).toBe("text/csv");
            expect(command.input.ContentDisposition).toBe(
                'attachment; filename="export.csv"',
            );
        }
    });
});
