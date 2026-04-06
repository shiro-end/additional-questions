export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          token: string;
          candidate_name: string;
          candidate_email: string;
          is_used: boolean;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          token?: string;
          candidate_name: string;
          candidate_email: string;
          is_used?: boolean;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
      };
      questions: {
        Row: {
          id: string;
          session_id: string;
          order_index: number;
          question_text: string;
          time_limit_seconds: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          order_index: number;
          question_text: string;
          time_limit_seconds?: number;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
      };
      templates: {
        Row: {
          id: string;
          name: string;
          questions: TemplateQuestion[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          questions: TemplateQuestion[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
      };
    };
  };
}

export interface TemplateQuestion {
  question_text: string;
  time_limit_seconds: number;
}
