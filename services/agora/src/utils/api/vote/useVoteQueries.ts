import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useBackendVoteApi } from "../vote";
import { useAuthenticationStore } from "src/stores/authentication";
import { useInvalidateCommentQueries } from "../comment/useCommentQueries";
import type { VotingAction } from "src/shared/types/zod";
import type { AxiosErrorResponse } from "../common";
import { getErrorMessage } from "../common";
import { useNotify } from "../../ui/notify";
import type { FetchUserVotesForPostSlugIdsResponse } from "src/shared/types/dto";

export function useUserVotesQuery({ postSlugId }: { postSlugId: string }) {
  const { fetchUserVotesForPostSlugIds } = useBackendVoteApi();
  const { isGuestOrLoggedIn } = storeToRefs(useAuthenticationStore());

  return useQuery({
    queryKey: ["userVotes", postSlugId],
    queryFn: async () => {
      return await fetchUserVotesForPostSlugIds([postSlugId]);
    },
    enabled: computed(() => postSlugId.length > 0 && isGuestOrLoggedIn.value),
    staleTime: 1000 * 60 * 5, // 5 minutes like comments
    retry: false, // Disable auto-retry
  });
}

export function useVoteMutation(postSlugId: string) {
  const { castVoteForComment } = useBackendVoteApi();
  const { showNotifyMessage } = useNotify();
  const { markAnalysisAsStale } = useInvalidateCommentQueries();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opinionSlugId,
      voteAction,
    }: {
      opinionSlugId: string;
      voteAction: VotingAction;
    }) => {
      return castVoteForComment(opinionSlugId, voteAction);
    },

    onMutate: async ({ opinionSlugId, voteAction }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["userVotes", postSlugId] });

      // Snapshot the previous value for rollback
      const previousVotes = queryClient.getQueryData<FetchUserVotesForPostSlugIdsResponse>(
        ["userVotes", postSlugId]
      );

      // Optimistically update the cache
      queryClient.setQueryData<FetchUserVotesForPostSlugIdsResponse>(
        ["userVotes", postSlugId],
        (oldVotes) => {
          const votes = oldVotes ?? [];

          if (voteAction === "cancel") {
            // Remove the vote for this opinion
            return votes.filter((v) => v.opinionSlugId !== opinionSlugId);
          }

          // Find existing vote for this opinion
          const existingVoteIndex = votes.findIndex(
            (v) => v.opinionSlugId === opinionSlugId
          );

          const newVote = {
            opinionSlugId,
            votingAction: voteAction,
          };

          if (existingVoteIndex >= 0) {
            // Update existing vote
            const updatedVotes = [...votes];
            updatedVotes[existingVoteIndex] = newVote;
            return updatedVotes;
          } else {
            // Add new vote
            return [...votes, newVote];
          }
        }
      );

      // Return context with previous value for rollback
      return { previousVotes };
    },

    onError: (error: AxiosErrorResponse, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousVotes !== undefined) {
        queryClient.setQueryData(
          ["userVotes", postSlugId],
          context.previousVotes
        );
      }

      // Show error notification
      if (error?.code) {
        showNotifyMessage(getErrorMessage(error));
      } else {
        showNotifyMessage("Failed to cast vote. Please try again.");
      }
    },

    onSuccess: () => {
      // Mark analysis data as stale when a vote is cast without refetching immediately
      // This ensures data is considered outdated but only refetches when the user actually visits the analysis tab
      markAnalysisAsStale(postSlugId);
    },

    onSettled: () => {
      // NOTE: We intentionally do NOT invalidate here.
      // Invalidation would trigger a refetch from the read replica which may not have
      // the vote yet (replication lag), causing the optimistic update to be overwritten.
      // The staleTime of 5 minutes ensures eventual consistency while preserving
      // the optimistic state during the replication window.
    },

    retry: false,
  });
}

// Utility function to invalidate vote-related queries
export function useInvalidateVoteQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateUserVotes: (postSlugId: string) => {
      void queryClient.invalidateQueries({
        queryKey: ["userVotes", postSlugId],
      });
    },
    invalidateAll: (postSlugId: string) => {
      void queryClient.invalidateQueries({
        queryKey: ["userVotes", postSlugId],
      });
    },
  };
}
