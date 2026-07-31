package com.quizapp.user;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.regex.Pattern;

public final class ProfileSanitizer {
    public static final String DEFAULT_AVATAR = "images/icon.png";
    public static final int MAX_AVATAR_LENGTH = 100_000;

    private static final Pattern SAFE_RELATIVE_AVATAR =
            Pattern.compile("^(?:\\./)?[A-Za-z0-9][A-Za-z0-9_./-]*$");
    private static final Pattern SAFE_DATA_IMAGE =
            Pattern.compile("^data:image/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\\r\\n]+$",
                    Pattern.CASE_INSENSITIVE);

    private ProfileSanitizer() {
    }

    public static String displayName(String value, String fallback) {
        String cleaned = singleLine(value, 120);
        return cleaned.isBlank() ? singleLine(fallback, 120) : cleaned;
    }

    public static String singleLine(String value, int maxLength) {
        return truncate(stripControls(value, false).trim(), maxLength);
    }

    public static String multiLine(String value, int maxLength) {
        return truncate(stripControls(value, true).trim(), maxLength);
    }

    public static String avatarOrDefault(String value) {
        String trimmed = String.valueOf(value == null ? "" : value).trim();
        return isSafeAvatar(trimmed) ? trimmed : DEFAULT_AVATAR;
    }

    public static String requireSafeAvatar(String value) {
        String trimmed = String.valueOf(value == null ? "" : value).trim();
        if (trimmed.isBlank()) {
            return DEFAULT_AVATAR;
        }
        if (!isSafeAvatar(trimmed)) {
            throw new IllegalArgumentException("Invalid avatar URL or data.");
        }
        return trimmed;
    }

    private static boolean isSafeAvatar(String value) {
        if (value == null || value.isBlank() || value.length() > MAX_AVATAR_LENGTH) {
            return false;
        }

        String lower = value.toLowerCase(Locale.ROOT);
        if (lower.startsWith("data:")) {
            return SAFE_DATA_IMAGE.matcher(value).matches();
        }
        if (lower.startsWith("https://")) {
            return isSafeHttpsUrl(value);
        }
        return isSafeRelativeAvatar(value);
    }

    private static boolean isSafeHttpsUrl(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null
                    && uri.getRawUserInfo() == null;
        } catch (URISyntaxException exception) {
            return false;
        }
    }

    private static boolean isSafeRelativeAvatar(String value) {
        if (value.startsWith("/")
                || value.startsWith("//")
                || value.contains("\\")
                || value.contains("..")
                || value.contains(":")) {
            return false;
        }
        return SAFE_RELATIVE_AVATAR.matcher(value).matches();
    }

    private static String stripControls(String value, boolean allowLineBreaks) {
        String input = String.valueOf(value == null ? "" : value);
        StringBuilder cleaned = new StringBuilder(input.length());
        for (int index = 0; index < input.length(); index++) {
            char current = input.charAt(index);
            if (!Character.isISOControl(current)
                    || (allowLineBreaks && (current == '\n' || current == '\r' || current == '\t'))) {
                cleaned.append(current);
            }
        }
        return cleaned.toString();
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value == null ? "" : value;
        }
        return value.substring(0, maxLength);
    }
}
