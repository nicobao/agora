import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import pLimit from "p-limit";
import type { projectDocumentEncodingEnum } from "@/shared-backend/schema.js";
import type { ProjectDocumentContentType } from "@/shared/projectDocument.js";

export type CompressedProjectDocumentEncoding =
    (typeof projectDocumentEncodingEnum.enumValues)[number];
export type ProjectDocumentEncoding =
    | "identity"
    | CompressedProjectDocumentEncoding;

export interface CompressedProjectDocument {
    encoding: CompressedProjectDocumentEncoding;
    buffer: Buffer;
    checksumSha256: string;
}

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);
// Bound native compression work across requests, not separately per uploader.
const compressionLimit = pLimit(2);

export async function compressProjectDocument({
    buffer,
    contentType,
}: {
    buffer: Buffer;
    contentType: ProjectDocumentContentType;
}): Promise<CompressedProjectDocument[]> {
    if (contentType === "application/pdf") return [];
    return await compressionLimit(async () => {
        const representations: CompressedProjectDocument[] = [];
        for (const encoding of [
            "br",
            "gzip",
        ] satisfies CompressedProjectDocumentEncoding[]) {
            const compressed =
                encoding === "br"
                    ? await compressBrotli(buffer, {
                          params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
                      })
                    : await compressGzip(buffer);
            representations.push({
                encoding,
                buffer: compressed,
                checksumSha256: createHash("sha256")
                    .update(compressed)
                    .digest("base64"),
            });
        }
        return representations;
    });
}

/**
 * This parses only the fixed content-coding negotiation needed by document
 * grants, not media types or arbitrary HTTP parameters. Invalid members are
 * ignored; explicit exclusions take precedence over wildcard preferences.
 */
export function preferredProjectDocumentEncodings(
    header: string | undefined,
): ProjectDocumentEncoding[] {
    // An absent header accepts any coding (RFC 9110); prefer the gzip baseline.
    if (header === undefined) return ["gzip", "identity"];
    if (header.trim() === "") return ["identity"];
    const qualities = new Map<string, number>();
    for (const member of header.split(",")) {
        const parsed =
            /^\s*([!#$%&'*+.^_`|~\da-z-]+)\s*(?:;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i.exec(
                member,
            );
        if (parsed === null) continue;
        const encoding = parsed.at(1)?.toLowerCase();
        if (encoding === undefined) continue;
        const parsedQuality = parsed.at(2);
        const quality = parsedQuality === undefined ? 1 : Number(parsedQuality);
        qualities.set(
            encoding,
            Math.max(qualities.get(encoding) ?? 0, quality),
        );
    }
    const wildcard = qualities.get("*");
    const identity = qualities.get("identity");
    const candidates: { encoding: ProjectDocumentEncoding; quality: number }[] =
        [
            { encoding: "br", quality: qualities.get("br") ?? wildcard ?? 0 },
            {
                encoding: "gzip",
                quality: qualities.get("gzip") ?? wildcard ?? 0,
            },
            { encoding: "identity", quality: identity ?? 0 },
        ];
    const preferred = candidates
        .filter(({ quality }) => quality > 0)
        .sort((first, second) => second.quality - first.quality)
        .map(({ encoding }) => encoding);
    // Without an explicit identity preference, use it only as a fallback.
    if (identity === undefined && wildcard !== 0) preferred.push("identity");
    return preferred;
}
