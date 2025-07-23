import { type PostgresJsDatabase as PostgresDatabase } from "drizzle-orm/postgres-js";
import type { ImportPolisResults } from "@/shared/types/polis.js";
import * as postService from "./post.js";
import * as userService from "./user.js";
import * as voteService from "./voting.js";
import * as commentService from "./comment.js";
import type { ConversationIds } from "@/utils/dataStructure.js";
import { log } from "@/app.js";

interface LoadImportedPolisConversationProps {
    db: PostgresDatabase;
    polisUrl: string;
    importedPolisConversation: ImportPolisResults;
    proof: string;
    didWrite: string;
    authorId: string;
    postAsOrganization: string;
    indexConversationAt?: string;
    isLoginRequired: boolean;
    isIndexed: boolean;
}

export async function loadImportedPolisConversation({
    db,
    importedPolisConversation,
    polisUrl,
    proof,
    didWrite,
    authorId,
    postAsOrganization,
    indexConversationAt,
    isLoginRequired,
    isIndexed,
}: LoadImportedPolisConversationProps): Promise<ConversationIds> {
    // create conversation
    const ownername = importedPolisConversation.conversation_data.ownername;
    const conversationBody =
        ownername !== null
            ? `${importedPolisConversation.conversation_data.description}<br /><br />This conversation was initially imported from ${polisUrl}. The original author is ${ownername}.`
            : `${importedPolisConversation.conversation_data.description}<br /><br />This conversation was initially imported from ${polisUrl}`;
    // TODO: add ownername and other info in DB for future use
    const { conversationSlugId, conversationId, conversationContentId } =
        await postService.createNewPost({
            db: db,
            conversationTitle:
                importedPolisConversation.conversation_data.topic,
            conversationBody: conversationBody,
            pollingOptionList: null,
            authorId: authorId,
            didWrite: didWrite,
            proof: proof,
            indexConversationAt: indexConversationAt,
            postAsOrganization: postAsOrganization,
            isIndexed: isIndexed,
            isLoginRequired: isLoginRequired,
            seedOpinionList: [],
        });
    await db.transaction(async (tx) => {
        const { userIdPerParticipantId, participantCount } =
            await userService.bulkInsertUsersFromExternalPolisConvo({
                db: tx,
                importedPolisConversation,
                conversationSlugId,
            });
        if (
            importedPolisConversation.conversation_data.participant_count !==
            null
        ) {
            log.info(
                `Using importedPolisConversation.conversation_data.participant_count for importing conversationSlugId=${conversationSlugId}`,
            );
            if (
                importedPolisConversation.conversation_data
                    .participant_count !== participantCount
            )
                log.warn(
                    `importedPolisConversation.conversation_data.participant_count !== participantCount calculated from the votes when importing conversationSlugId=${conversationSlugId}`,
                );
        } else {
            log.warn(
                `importedPolisConversation.conversation_data.participant_count is null when importing conversationSlugId=${conversationSlugId}, using votes data`,
            );
        }
        await postService.updateParticipantCount({
            db: tx,
            conversationId,
            participantCount:
                importedPolisConversation.conversation_data.participant_count ??
                participantCount,
        });

        const { opinionIdPerStatementId, opinionContentIdPerOpinionId } =
            await commentService.bulkInsertOpinionsFromExternalPolisConvo({
                db: tx,
                importedPolisConversation,
                conversationId,
                conversationSlugId,
                conversationContentId,
                userIdPerParticipantId,
            });
        await voteService.bulkInsertVotesFromExternalPolisConvo({
            db: tx,
            importedPolisConversation,
            opinionIdPerStatementId,
            opinionContentIdPerOpinionId,
            userIdPerParticipantId,
            conversationSlugId,
        });
    });
    return { conversationSlugId, conversationId, conversationContentId };
}
