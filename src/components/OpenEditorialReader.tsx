import { OpenEditorialStaticReader } from "./OpenEditorialStaticReader";

export function OpenEditorialReader({ chapterId, revision }: { chapterId: string; revision: string }) {
  return <OpenEditorialStaticReader chapterId={chapterId} revision={revision} />;
}
