export interface Project {
  id: string;
  title: string;
  field: string;
  level: string;
  members: string[];
  teacher: string;
  problem: string;
  importance: string;
  objectives: string[];
  methods: string[];
  createdAt: number;
  updatedAt: number;
  progress: number;
  content: {
    introduction: {
      reason: string;
      purpose: string;
      questions: string;
      hypothesis: string;
    };
    body: {
      chapter1: string;
      chapter2: string;
      chapter3: string;
      chapter4: string;
    };
    conclusion: {
      summary: string;
      suggestions: string;
    };
    appendix: {
      references: string;
    };
  };
}

export type ViewState = 'dashboard' | 'wizard' | 'editor' | 'library';

export type SectionKey = keyof Project['content']['introduction'] | keyof Project['content']['body'] | keyof Project['content']['conclusion'] | keyof Project['content']['appendix'];
