export type Thesis = {
  number: string;
  title: string;
  text: string;
  consequence?: string;
  sourceIds?: string[];
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

