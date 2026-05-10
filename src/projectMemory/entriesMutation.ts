import { isProjectMemoryBootstrapStoredItem } from "./bootstrapStoredHelpers";
import { isProjectMemoryEditorIngestStoredItem } from "./editorStoredHelpers";
import { workspaceRelativePathsMatch } from "./workspaceRelativePath";

/** Quita entradas bootstrap/editor cuyo `relativePath` coincide con `targetRel`. */
export function removeIndexedEntriesForRelativePath(
  items: readonly unknown[],
  targetRel: string,
): unknown[] {
  return items.filter((item) => {
    if (isProjectMemoryBootstrapStoredItem(item)) {
      return !workspaceRelativePathsMatch(item.relativePath, targetRel);
    }
    if (isProjectMemoryEditorIngestStoredItem(item)) {
      return !workspaceRelativePathsMatch(item.relativePath, targetRel);
    }
    return true;
  });
}
