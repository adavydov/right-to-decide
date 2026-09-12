import {getLegacyEditorialTeamDocument} from "@/lib/editorial-team";
export const dynamic="force-static";
export function GET(){return Response.json(getLegacyEditorialTeamDocument(true));}
