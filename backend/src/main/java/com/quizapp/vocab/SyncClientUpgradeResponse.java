package com.quizapp.vocab;

public record SyncClientUpgradeResponse(
        String error,
        String message,
        int requiredSyncContractVersion
) {
    public static SyncClientUpgradeResponse standard() {
        return new SyncClientUpgradeResponse(
                "SYNC_CLIENT_UPGRADE_REQUIRED",
                "Please refresh the app before syncing.",
                SyncService.SYNC_CONTRACT_VERSION
        );
    }
}
