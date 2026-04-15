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
          opened_at: string | null;
        };
        Insert: {
          id?: string;
          token?: string;
          candidate_name: string;
          candidate_email: string;
          is_used?: boolean;
          created_at?: string;
          expires_at?: string | null;
          opened_at?: string | null;
        };
        Update: {
          id?: string;
          token?: string;
          candidate_name?: string;
          candidate_email?: string;
          is_used?: boolean;
          created_at?: string;
          expires_at?: string | null;
          opened_at?: string | null;
        };
        Relationships: [];
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
        Update: {
          id?: string;
          session_id?: string;
          order_index?: number;
          question_text?: string;
          time_limit_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      job_postings: {
        Row: {
          id: string;
          title: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      job_questions: {
        Row: {
          id: string;
          job_id: string;
          order_index: number;
          question_text: string;
          time_limit_seconds: number;
        };
        Insert: {
          id?: string;
          job_id: string;
          order_index: number;
          question_text: string;
          time_limit_seconds?: number;
        };
        Update: {
          id?: string;
          job_id?: string;
          order_index?: number;
          question_text?: string;
          time_limit_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_questions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_postings";
            referencedColumns: ["id"];
          },
        ];
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
        Update: {
          id?: string;
          name?: string;
          questions?: TemplateQuestion[];
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export interface TemplateQuestion {
  question_text: string;
  time_limit_seconds: number;
}
