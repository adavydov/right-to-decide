export type Thesis = {
  number: string;
  title: string;
  text: string;
  consequence?: string;
  sourceIds?: string[];
};

export type ThesisGroup = {
  title: string;
  thesis: string;
  items: Thesis[];
};

export type BookPart = {
  number: string;
  title: string;
  thesis: string;
  chapters: string[];
};

export type WorldPractice = {
  number: string;
  title: string;
  mechanism: string;
  evidence: string;
  boundary: string;
  links: Array<{ label: string; url: string }>;
};

export type Novelty = {
  number: string;
  title: string;
  text: string;
};

export type Stakeholder = {
  audience: string;
  warning: string;
  demand: string;
};

export type SourceRecord = {
  id: string;
  title: string;
  organization: string;
  url: string;
  boundary: string;
};
