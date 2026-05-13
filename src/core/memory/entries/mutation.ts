import { isProjectMemoryBootstrapStoredItem } from "./bootstrap";
import { isProjectMemoryEditorIngestStoredItem } from "./editor";
import { workspaceRelativePathsMatch } from "../io/path";

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
