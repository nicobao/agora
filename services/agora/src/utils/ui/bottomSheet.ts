import { useQuasar } from "quasar";
import { type Ref } from "vue";
import { useBackendPostApi } from "../api/post";
import { useUserStore } from "src/stores/user";
import { useHomeFeedStore } from "src/stores/homeFeed";
import { useNotify } from "./notify";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useAuthenticationStore } from "src/stores/authentication";

export const useBottomSheet = () => {
  const quasar = useQuasar();

  const { showNotifyMessage } = useNotify();

  const router = useRouter();
  const route = useRoute();

  const { deletePostBySlugId } = useBackendPostApi();

  const { profileData } = storeToRefs(useUserStore());
  const { loadUserProfile } = useUserStore();
  const { loadPostData } = useHomeFeedStore();
  const { isLoggedIn } = storeToRefs(useAuthenticationStore());

  interface QuasarAction {
    label: string;
    icon: string;
    id: string;
  }

  async function showCommentOptionSelector(
    posterUserName: string,
    deleteCommentCallback: () => void,
    reportCommentCallback: () => void,
    openUserReportsCallback: () => void,
    muteUserCallback: () => void,
    moderateCommentCallback: () => void,
    shareOpinionCallback: () => void
  ) {
    const actionList: QuasarAction[] = [];

    actionList.push({
      label: "Report",
      icon: "mdi-flag",
      id: "report",
    });

    if (profileData.value.userName != posterUserName && isLoggedIn.value) {
      actionList.push({
        label: "Mute User",
        icon: "mdi-account-off",
        id: "muteUser",
      });
    }

    if (profileData.value.userName == posterUserName) {
      actionList.push({
        label: "Delete",
        icon: "mdi-delete",
        id: "delete",
      });
    }

    if (profileData.value.isModerator) {
      actionList.push({
        label: "Moderate",
        icon: "mdi-sword",
        id: "moderate",
      });

      actionList.push({
        label: "User Reports",
        icon: "mdi-account-alert",
        id: "userReports",
      });
    }

    actionList.push({
      label: "Share",
      icon: "mdi-export-variant",
      id: "share",
    });

    quasar
      .bottomSheet({
        message: "Select an action for this comment",
        grid: false,
        actions: actionList,
      })
      .onOk(async (action: QuasarAction) => {
        console.log("Selected action: " + action.id);
        if (action.id == "report") {
          reportCommentCallback();
        } else if (action.id == "delete") {
          deleteCommentCallback();
        } else if (action.id == "moderate") {
          moderateCommentCallback();
        } else if (action.id == "userReports") {
          openUserReportsCallback();
        } else if (action.id == "muteUser") {
          muteUserCallback();
        } else if (action.id == "share") {
          shareOpinionCallback();
        }
      })
      .onCancel(() => {
        console.log("Dismissed");
      })
      .onDismiss(() => {
        // console.log('I am triggered on both OK and Cancel')
      });
  }

  function showPostOptionSelector(
    postSlugId: string,
    posterUserName: string,
    reportPostCallback: () => void,
    openUserReportsCallback: () => void,
    muteUserCallback: () => void,
    moderatePostCallback: () => void,
    moderationHistoryCallback: () => void
  ) {
    const actionList: QuasarAction[] = [];

    actionList.push({
      label: "Report",
      icon: "mdi-flag",
      id: "report",
    });

    if (profileData.value.userName != posterUserName && isLoggedIn.value) {
      actionList.push({
        label: "Mute User",
        icon: "mdi-account-off",
        id: "muteUser",
      });
    }

    if (profileData.value.userName == posterUserName) {
      actionList.push({
        label: "Delete",
        icon: "mdi-delete",
        id: "delete",
      });
    }

    actionList.push({
      label: "Moderation History",
      icon: "mdi-book-open",
      id: "moderationHistory",
    });

    if (profileData.value.isModerator) {
      actionList.push({
        label: "Moderate",
        icon: "mdi-sword",
        id: "moderate",
      });

      actionList.push({
        label: "User Reports",
        icon: "mdi-account-alert",
        id: "userReports",
      });
    }

    quasar
      .bottomSheet({
        message: "Select an action for this post",
        grid: false,
        actions: actionList,
      })
      .onOk(async (action: QuasarAction) => {
        if (action.id == "report") {
          reportPostCallback();
        } else if (action.id == "delete") {
          const response = await deletePostBySlugId(postSlugId);
          if (response) {
            showNotifyMessage("Conversation deleted");
            await loadPostData();
            await loadUserProfile();
            if (route.name == "/conversation/[postSlugId]") {
              await router.push({ name: "/" });
            }
          }
        } else if (action.id == "moderate") {
          moderatePostCallback();
        } else if (action.id == "userReports") {
          openUserReportsCallback();
        } else if (action.id == "muteUser") {
          muteUserCallback();
        } else if (action.id == "moderationHistory") {
          moderationHistoryCallback();
        }
      })
      .onCancel(() => {
        console.log("Dismissed");
      })
      .onDismiss(() => {
        // console.log('I am triggered on both OK and Cancel')
      });
  }

  function showCommentRankingReportSelector(reportReasonId: Ref<string>) {
    const actionList: QuasarAction[] = [];

    const icon = "mdi-circle-small";

    actionList.push(
      {
        label: "Spam",
        icon: icon,
        id: "spam",
      },
      {
        label: "Irrelevant",
        icon: icon,
        id: "irrelevant",
      },
      {
        label: "Harassment",
        icon: icon,
        id: "harassment",
      },
      {
        label: "Hate",
        icon: icon,
        id: "hate",
      },
      {
        label: "Sharing personal information",
        icon: icon,
        id: "personal-information",
      },
      {
        label: "Threatening violence",
        icon: icon,
        id: "violence",
      },
      {
        label: "Sexualization",
        icon: icon,
        id: "sexualization",
      }
    );

    quasar
      .bottomSheet({
        message:
          "Why do you think this comment is not appropriate for ranking?",
        grid: false,
        actions: actionList,
      })
      .onOk((action: QuasarAction) => {
        console.log("Selected action: " + action.id);
        reportReasonId.value = action.id;
      })
      .onCancel(() => {
        console.log("Dismissed");
      })
      .onDismiss(() => {
        // console.log('I am triggered on both OK and Cancel')
      });
  }

  return {
    showPostOptionSelector,
    showCommentRankingReportSelector,
    showCommentOptionSelector,
  };
};
