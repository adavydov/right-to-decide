export type PublicEditorialTeam = {
  schemaVersion:number; version:string; updated:string; title:string; intro:string; roleNote:string;
  humanDirection:{title:string;description:string};
  roles:{id:string;name:string;description:string;libraryThemes:string[]}[];
  workflow:{id:string;title:string;description:string;roleIds:string[]}[];
};
