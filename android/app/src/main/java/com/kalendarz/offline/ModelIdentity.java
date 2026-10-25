package com.kalendarz.offline;

/** Opaque model IDs are filenames, never paths. Catalogue versions contain dots. */
final class ModelIdentity {
    static boolean valid(String id) {
        return id != null && id.matches("[a-z0-9][a-z0-9._-]{0,89}") && !id.contains("..");
    }
    private ModelIdentity() {}
}
