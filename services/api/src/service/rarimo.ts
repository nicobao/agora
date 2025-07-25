// This file, along with the integration of the Rarimo protocol into Agora, was originally developed with funding from the European Union’s Horizon Europe 2020 research and innovation program, as part of the NGI SARGASSO project under grant agreement No. 101092887.

import { deviceTable, zkPassportTable } from "@/schema.js";
import type {
    GenerateVerificationLink200,
    VerifyUserStatusAndAuthenticate200,
} from "@/shared/types/dto.js";
import {
    type LinkType,
    type RarimoStatusAttributes,
} from "@/shared/types/zod.js";
import { type AxiosInstance } from "axios";
import { type PostgresJsDatabase as PostgresDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { nowZeroMs } from "@/shared/common/util.js";
import {
    getZKPAuthenticationType,
    loginKnownDeviceWithZKP,
    loginNewDeviceWithZKP,
    registerWithZKP,
} from "@/service/auth.js";
import { decimalToHex, hexToUtf8 } from "@/utils/dataStructure.js";

interface IsLoggedInOrExistsAndAssociatedWithNoNullifierProps {
    db: PostgresDatabase;
    didWrite: string;
    now: Date;
}

interface GenerateVerificationLinkProps {
    db: PostgresDatabase;
    didWrite: string;
    axiosVerificatorSvc: AxiosInstance;
    baseEventId: string;
    linkType: LinkType;
}

// Representing the LinksAttributes structure
interface LinksAttributes {
    // Returns proof-parameters and callback_url
    get_proof_params: string;
}

// Representing the Links structure
interface Links {
    key: string; // Assuming "Key" maps to a string or could be replaced with a more specific type.
    attributes: LinksAttributes;
}

// Representing the VerificationLinksResponse structure
export interface VerificationLinksResponse {
    data: Links;
}

// ProofData represents the SnarkJS library result of proof generation
interface ProofData {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
}

// ZKProof is proof data with public signals
interface ZKProof {
    proof: ProofData;
    pub_signals: string[];
}

interface UserParamsAttributes {
    // Lower user age limit
    proof: ZKProof;
}

interface UserParams {
    attributes: UserParamsAttributes;
}

interface UserParamsRequest {
    data: UserParams;
}

interface GetUserProofProps {
    didWrite: string;
    axiosVerificatorSvc: AxiosInstance;
}

interface GetUserProofReturn {
    nationality: string;
    nullifier: string;
    sex: string;
}

interface StatusAttributes {
    status: RarimoStatusAttributes;
}

interface Status {
    attributes: StatusAttributes;
}

interface StatusResponse {
    data: Status;
}

interface VerifyUserStatusProps {
    db: PostgresDatabase;
    didWrite: string;
    axiosVerificatorSvc: AxiosInstance;
    userAgent: string;
}

export async function isLoggedInOrExistsAndAssociatedWithNoNullifier({
    db,
    didWrite,
    now,
}: IsLoggedInOrExistsAndAssociatedWithNoNullifierProps): Promise<
    "already_logged_in" | "associated_with_another_user" | undefined
> {
    const result = await db
        .select({
            userId: deviceTable.userId,
            sessionExpiry: deviceTable.sessionExpiry,
            nullifier: zkPassportTable.nullifier,
        })
        .from(deviceTable)
        .leftJoin(
            zkPassportTable,
            eq(deviceTable.userId, zkPassportTable.userId),
        )
        .where(eq(deviceTable.didWrite, didWrite));
    if (result.length !== 0) {
        // device was registered
        const resultLoggedIn = result.find((r) => r.sessionExpiry > now);
        if (resultLoggedIn !== undefined) {
            return "already_logged_in";
        }
        const resultWithNullifier = result.find((r) => r.nullifier !== null);
        if (resultWithNullifier === undefined) {
            return "associated_with_another_user";
        }
    }
}

export async function generateVerificationLink({
    db,
    didWrite,
    axiosVerificatorSvc,
    baseEventId,
    linkType,
}: GenerateVerificationLinkProps): Promise<GenerateVerificationLink200> {
    const now = nowZeroMs();
    //TODO: move this to controller's verifyUCAN
    const deviceStatus = await isLoggedInOrExistsAndAssociatedWithNoNullifier({
        db,
        didWrite,
        now,
    });
    if (deviceStatus !== undefined) {
        return {
            success: false,
            reason: deviceStatus,
        };
    }
    const getVerificationLinkUrl =
        "/integrations/verificator-svc/private/verification-link";
    const userId = didWrite;
    const body = {
        data: {
            id: userId,
            type: "user",
            attributes: {
                age_lower_bound: 16,
                uniqueness: true,
                nationality_check: true,
                event_id: baseEventId,
                sex: true,
            },
        },
    };
    const response = await axiosVerificatorSvc.post<VerificationLinksResponse>(
        getVerificationLinkUrl,
        body,
        {
            headers: {
                "Content-Type": "application/json",
            },
        },
    );
    const protocolType =
        linkType === "deep" ? "rarime://" : "https://app.rarime.com/";
    const proofParams = response.data.data.attributes.get_proof_params;
    return {
        success: true,
        verificationLink: `${protocolType}external?type=proof-request&proof_params_url=${proofParams}`,
    };
}

// see https://github.com/rarimo/passport-zk-circuits?tab=readme-ov-file#query-circuit-public-signals
function extractDataFromPubSignals(pubSignals: string[]): GetUserProofReturn {
    return {
        nationality: hexToUtf8(decimalToHex(pubSignals[6])),
        nullifier: decimalToHex(pubSignals[0]),
        sex: hexToUtf8(decimalToHex(pubSignals[7])),
    };
}

async function getUserProof({
    didWrite,
    axiosVerificatorSvc,
}: GetUserProofProps): Promise<GetUserProofReturn> {
    const getUserProofUrl = `/integrations/verificator-svc/private/proof/${didWrite}`;
    const response =
        await axiosVerificatorSvc.get<UserParamsRequest>(getUserProofUrl);
    const userParamsRequest: UserParamsRequest = response.data;
    const extractedData = extractDataFromPubSignals(
        userParamsRequest.data.attributes.proof.pub_signals,
    );
    return extractedData;
}

export async function verifyUserStatusAndAuthenticate({
    db,
    didWrite,
    axiosVerificatorSvc,
    userAgent,
}: VerifyUserStatusProps): Promise<VerifyUserStatusAndAuthenticate200> {
    const now = nowZeroMs();
    // TODO: move this check to verifyUCAN directly in the controller:
    const badStatusReason =
        await isLoggedInOrExistsAndAssociatedWithNoNullifier({
            db,
            didWrite,
            now,
        });
    if (badStatusReason !== undefined) {
        return {
            success: false,
            reason: badStatusReason,
        };
    }
    const verifyUserStatusUrl = `/integrations/verificator-svc/private/verification-status/${didWrite}`;
    const response =
        await axiosVerificatorSvc.get<StatusResponse>(verifyUserStatusUrl);
    const statusResponse: StatusResponse = response.data;
    const rarimoStatus = statusResponse.data.attributes.status;
    if (rarimoStatus !== "verified") {
        return { success: true, rarimoStatus };
    }
    // retrieve the user attributes
    const { nationality, sex, nullifier } = await getUserProof({
        didWrite,
        axiosVerificatorSvc,
    });
    const { type, userId } = await getZKPAuthenticationType({
        db,
        nullifier,
        didWrite,
    });
    // log-in or register depending on the state
    const loginSessionExpiry = new Date(now);
    loginSessionExpiry.setFullYear(loginSessionExpiry.getFullYear() + 1000);
    switch (type) {
        case "associated_with_another_user":
            return { success: false, reason: "associated_with_another_user" };
        case "register":
            // const parsedCitizenship = zodCountryCodeEnum.safeParse(nationality);
            // if (!parsedCitizenship.success) {
            //     throw httpErrors.internalServerError(
            //         `Received nationality ${nationality} is not part of expected enum`,
            //     );
            // }
            await registerWithZKP({
                db,
                didWrite,
                citizenship: nationality,
                nullifier,
                sex: sex,
                userAgent,
                userId,
                sessionExpiry: loginSessionExpiry,
            });
            break;
        case "login_known_device":
            await loginKnownDeviceWithZKP({
                db,
                didWrite,
                now,
                sessionExpiry: loginSessionExpiry,
            });
            break;
        case "login_new_device":
            await loginNewDeviceWithZKP({
                db,
                didWrite,
                userId,
                userAgent,
                sessionExpiry: loginSessionExpiry,
            });
            break;
    }
    return { success: true, rarimoStatus };
}
