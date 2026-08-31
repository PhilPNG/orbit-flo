export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = "owner" | "admin" | "member";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type ProjectPriority = "low" | "medium" | "high" | "critical";

export type RecurrencePattern = "daily" | "weekdays" | "weekly" | "monthly";
export type ProjectHealth = "good" | "watch" | "at_risk" | "blocked";
export type LabelColor = "cyan" | "blue" | "violet" | "emerald" | "amber" | "rose";

export type WorkItemStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "review"
  | "done";
export type NoteType = "idea" | "question" | "decision" | "risk" | "reference";
export type LinkType =
  | "repository"
  | "documentation"
  | "design"
  | "deployment"
  | "issue_tracker"
  | "other";
export type DailyPlanStatus = "planned" | "active" | "completed";
export type DailyPlanItemState = "planned" | "completed" | "skipped";
export type CaptureType = "task" | "note" | "idea" | "blocker";
export type MindMapView = "mind_map" | "flowchart" | "timeline" | "decision_tree";
export type MindMapNodeType =
  | "idea"
  | "task_candidate"
  | "note"
  | "milestone"
  | "decision"
  | "option"
  | "risk"
  | "reference";
export type MindMapNodeStatus = "open" | "selected" | "rejected" | "converted" | "archived";
export type MindMapEdgeType = "association" | "dependency" | "sequence" | "choice" | "outcome";
export type MindMapConvertedObjectType = "task" | "note" | "milestone";
export type SignalKind =
  | "assigned"
  | "unassigned"
  | "commented"
  | "mentioned"
  | "invitation_accepted"
  | "role_changed"
  | "removed_from_workspace";

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          role?: WorkspaceRole;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          priority: ProjectPriority;
          health: ProjectHealth;
          color: string | null;
          rituals_title: string | null;
          is_favorite: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          priority?: ProjectPriority;
          health?: ProjectHealth;
          color?: string | null;
          rituals_title?: string | null;
          is_favorite?: boolean;
          created_by: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: ProjectStatus;
          priority?: ProjectPriority;
          health?: ProjectHealth;
          color?: string | null;
          rituals_title?: string | null;
          is_favorite?: boolean;
        };
        Relationships: [];
      };
      template_usage: {
        Row: {
          id: string;
          workspace_id: string;
          template_id: string;
          use_count: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          template_id: string;
          use_count?: number;
          created_by?: string;
        };
        Update: {
          use_count?: number;
        };
        Relationships: [];
      };
      project_rituals: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          title: string;
          is_done: boolean;
          sort_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          title: string;
          is_done?: boolean;
          sort_order?: number;
          created_by?: string;
        };
        Update: {
          title?: string;
          is_done?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      workspace_invitations: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role: WorkspaceRole;
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      note_links: {
        Row: {
          id: string;
          workspace_id: string;
          note_id: string;
          target_note_id: string | null;
          target_work_item_id: string | null;
          target_project_id: string | null;
          target_milestone_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          note_id: string;
          target_note_id?: string | null;
          target_work_item_id?: string | null;
          target_project_id?: string | null;
          target_milestone_id?: string | null;
          created_by: string;
        };
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
        };
        Update: {
          display_name?: string;
        };
        Relationships: [];
      };
      project_links: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          link_type: LinkType;
          label: string;
          url: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id: string;
          link_type?: LinkType;
          label: string;
          url: string;
          created_by: string;
        };
        Update: {
          link_type?: LinkType;
          label?: string;
          url?: string;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          title: string;
          description: string | null;
          target_date: string | null;
          completed_at: string | null;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id: string;
          title: string;
          description?: string | null;
          target_date?: string | null;
          sort_order?: number;
          created_by: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      recurrence_rules: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          title: string;
          description: string | null;
          priority: ProjectPriority;
          pattern: RecurrencePattern;
          weekdays: number[];
          day_of_month: number | null;
          planned_at: string | null;
          planned_minutes: number | null;
          is_active: boolean;
          generated_through: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          title: string;
          description?: string | null;
          priority?: ProjectPriority;
          pattern: RecurrencePattern;
          weekdays?: number[];
          day_of_month?: number | null;
          planned_at?: string | null;
          planned_minutes?: number | null;
          is_active?: boolean;
          generated_through?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          priority?: ProjectPriority;
          pattern?: RecurrencePattern;
          weekdays?: number[];
          day_of_month?: number | null;
          planned_at?: string | null;
          planned_minutes?: number | null;
          is_active?: boolean;
          generated_through?: string | null;
        };
        Relationships: [];
      };
      work_items: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          milestone_id: string | null;
          assigned_to: string | null;
          column_id: string | null;
          recurrence_rule_id: string | null;
          occurrence_date: string | null;
          title: string;
          description: string | null;
          status: WorkItemStatus;
          priority: ProjectPriority;
          planned_at: string | null;
          planned_minutes: number | null;
          due_date: string | null;
          estimate_points: number | null;
          sort_order: number;
          blocked_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          workspace_id: string;
          project_id: string;
          milestone_id?: string | null;
          assigned_to?: string | null;
          column_id?: string | null;

          recurrence_rule_id?: string | null;

          occurrence_date?: string | null;
          title: string;
          description?: string | null;
          status?: WorkItemStatus;
          priority?: ProjectPriority;
          planned_at?: string | null;
          planned_minutes?: number | null;
          due_date?: string | null;
          estimate_points?: number | null;
          sort_order?: number;
          blocked_reason?: string | null;
          created_by: string;
        };
        Update: {
          milestone_id?: string | null;
          assigned_to?: string | null;
          column_id?: string | null;

          recurrence_rule_id?: string | null;

          occurrence_date?: string | null;
          title?: string;
          description?: string | null;
          status?: WorkItemStatus;
          priority?: ProjectPriority;
          planned_at?: string | null;
          planned_minutes?: number | null;
          due_date?: string | null;
          estimate_points?: number | null;
          sort_order?: number;
          blocked_reason?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      work_item_comments: {
        Row: {
          id: string;
          workspace_id: string;
          work_item_id: string;
          body: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          work_item_id: string;
          body: string;
          created_by?: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [];
      };
      labels: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          name: string;
          color: LabelColor;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          name: string;
          color: LabelColor;
          created_by?: string;
        };
        Update: {
          name?: string;
          color?: LabelColor;
        };
        Relationships: [];
      };
      work_item_labels: {
        Row: {
          work_item_id: string;
          label_id: string;
          workspace_id: string;
        };
        Insert: {
          work_item_id: string;
          label_id: string;
          workspace_id: string;
        };
        Update: {
          work_item_id?: string;
          label_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      work_item_checklist_items: {
        Row: {
          id: string;
          workspace_id: string;
          work_item_id: string;
          title: string;
          is_done: boolean;
          sort_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          work_item_id: string;
          title: string;
          is_done?: boolean;
          sort_order?: number;
          created_by?: string;
        };
        Update: {
          title?: string;
          is_done?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      work_item_attachments: {
        Row: {
          id: string;
          workspace_id: string;
          work_item_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          work_item_id: string;
          file_name: string;
          storage_path: string;
          mime_type?: string;
          size_bytes?: number;
          created_by?: string;
        };
        Update: {
          file_name?: string;
        };
        Relationships: [];
      };
      board_columns: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          title: string;
          status_category: WorkItemStatus;
          sort_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          title: string;
          status_category: WorkItemStatus;
          sort_order?: number;
          created_by?: string;
        };
        Update: {
          title?: string;
          status_category?: WorkItemStatus;
          sort_order?: number;
        };
        Relationships: [];
      };
      daily_plans: {
        Row: {
          id: string;
          workspace_id: string;
          plan_date: string;
          status: DailyPlanStatus;
          reflection: string | null;
          completed_count: number;
          skipped_count: number;
          recurring_missed_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          plan_date: string;
          status?: DailyPlanStatus;
          reflection?: string | null;
          completed_count?: number;
          skipped_count?: number;
          recurring_missed_count?: number;
          created_by: string;
        };
        Update: {
          status?: DailyPlanStatus;
          reflection?: string | null;
          completed_count?: number;
          skipped_count?: number;
          recurring_missed_count?: number;
        };
        Relationships: [];
      };
      daily_plan_items: {
        Row: {
          id: string;
          workspace_id: string;
          daily_plan_id: string;
          work_item_id: string;
          sort_order: number;
          is_primary: boolean;
          state: DailyPlanItemState;
          completed_at: string | null;
          skipped_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          daily_plan_id: string;
          work_item_id: string;
          sort_order?: number;
          is_primary?: boolean;
          state?: DailyPlanItemState;
        };
        Update: {
          sort_order?: number;
          is_primary?: boolean;
          state?: DailyPlanItemState;
          completed_at?: string | null;
          skipped_at?: string | null;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          work_item_id: string | null;
          note_type: NoteType;
          title: string;
          body: string | null;
          tags: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id?: string | null;
          work_item_id?: string | null;
          note_type?: NoteType;
          title: string;
          body?: string | null;
          tags?: string[];
          created_by: string;
        };
        Update: {
          note_type?: NoteType;
          title?: string;
          body?: string | null;
          tags?: string[];
        };
        Relationships: [];
      };
      captures: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          work_item_id: string | null;
          type: CaptureType;
          title: string;
          body: string | null;
          processed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id?: string | null;
          work_item_id?: string | null;
          type?: CaptureType;
          title: string;
          body?: string | null;
          created_by: string;
        };
        Update: {
          project_id?: string | null;
          work_item_id?: string | null;
          type?: CaptureType;
          title?: string;
          body?: string | null;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      weekly_reviews: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          week_start: string;
          wins: string | null;
          blockers: string | null;
          next_focus: string | null;
          health: ProjectHealth | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id?: string | null;
          week_start: string;
          wins?: string | null;
          blockers?: string | null;
          next_focus?: string | null;
          health?: ProjectHealth | null;
          created_by: string;
        };
        Update: {
          week_start?: string;
          wins?: string | null;
          blockers?: string | null;
          next_focus?: string | null;
          health?: ProjectHealth | null;
        };
        Relationships: [];
      };
      project_briefs: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          goal: string;
          audience: string;
          success_criteria: string;
          constraints: string;
          status_summary: string;
          next_milestone: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id: string;
          goal?: string;
          audience?: string;
          success_criteria?: string;
          constraints?: string;
          status_summary?: string;
          next_milestone?: string;
          created_by?: string | null;
        };
        Update: {
          goal?: string;
          audience?: string;
          success_criteria?: string;
          constraints?: string;
          status_summary?: string;
          next_milestone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_briefs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_briefs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_briefs_project_id_workspace_id_fkey";
            columns: ["project_id", "workspace_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
        ];
      };
      launch_checklists: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          milestone_id: string | null;
          title: string;
          checklist_items: Json;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id: string;
          milestone_id?: string | null;
          title?: string;
          checklist_items?: Json;
          completed_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          milestone_id?: string | null;
          title?: string;
          checklist_items?: Json;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "launch_checklists_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "launch_checklists_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "launch_checklists_project_id_workspace_id_fkey";
            columns: ["project_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "launch_checklists_milestone_id_workspace_id_project_id_fkey";
            columns: ["milestone_id", "workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "milestones";
            referencedColumns: ["id", "workspace_id", "project_id"];
          },
        ];
      };
      meeting_notes: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          title: string;
          meeting_date: string;
          attendees: string[];
          discussion: string;
          decisions: string;
          risks: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id?: string | null;
          title: string;
          meeting_date?: string;
          attendees?: string[];
          discussion?: string;
          decisions?: string;
          risks?: string;
          created_by?: string | null;
        };
        Update: {
          project_id?: string | null;
          title?: string;
          meeting_date?: string;
          attendees?: string[];
          discussion?: string;
          decisions?: string;
          risks?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_notes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_notes_project_id_workspace_id_fkey";
            columns: ["project_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
        ];
      };
      meeting_action_items: {
        Row: {
          id: string;
          workspace_id: string;
          meeting_note_id: string;
          project_id: string | null;
          work_item_id: string | null;
          title: string;
          owner_label: string;
          due_date: string | null;
          is_converted: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          meeting_note_id: string;
          project_id?: string | null;
          work_item_id?: string | null;
          title: string;
          owner_label?: string;
          due_date?: string | null;
          is_converted?: boolean;
          created_by?: string | null;
        };
        Update: {
          project_id?: string | null;
          work_item_id?: string | null;
          title?: string;
          owner_label?: string;
          due_date?: string | null;
          is_converted?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_action_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_action_items_meeting_note_id_workspace_id_fkey";
            columns: ["meeting_note_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "meeting_notes";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "meeting_action_items_project_id_workspace_id_fkey";
            columns: ["project_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "meeting_action_items_work_item_id_workspace_id_project_id_fkey";
            columns: ["work_item_id", "workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "work_items";
            referencedColumns: ["id", "workspace_id", "project_id"];
          },
        ];
      };
      mind_maps: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          title: string;
          description: string;
          default_view: MindMapView;
          created_by: string;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          title: string;
          description?: string;
          default_view?: MindMapView;
          created_by?: string;
        };
        Update: {
          project_id?: string | null;
          title?: string;
          description?: string;
          default_view?: MindMapView;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      mind_map_nodes: {
        Row: {
          id: string;
          workspace_id: string;
          map_id: string;
          node_type: MindMapNodeType;
          status: MindMapNodeStatus;
          title: string;
          body: string;
          position_x: number;
          position_y: number;
          width: number | null;
          height: number | null;
          accent: string;
          start_date: string | null;
          due_date: string | null;
          tags: string[];
          metadata: Json;
          linked_type: string | null;
          linked_id: string | null;
          converted_type: string | null;
          converted_id: string | null;
          converted_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          map_id: string;
          node_type?: MindMapNodeType;
          status?: MindMapNodeStatus;
          title: string;
          body?: string;
          position_x?: number;
          position_y?: number;
          width?: number | null;
          height?: number | null;
          accent?: string;
          start_date?: string | null;
          due_date?: string | null;
          tags?: string[];
          metadata?: Json;
          linked_type?: string | null;
          linked_id?: string | null;
          converted_type?: string | null;
          converted_id?: string | null;
          converted_at?: string | null;
          created_by?: string;
        };
        Update: {
          node_type?: MindMapNodeType;
          status?: MindMapNodeStatus;
          title?: string;
          body?: string;
          position_x?: number;
          position_y?: number;
          width?: number | null;
          height?: number | null;
          accent?: string;
          start_date?: string | null;
          due_date?: string | null;
          tags?: string[];
          metadata?: Json;
          linked_type?: string | null;
          linked_id?: string | null;
          converted_type?: string | null;
          converted_id?: string | null;
          converted_at?: string | null;
        };
        Relationships: [];
      };
      mind_map_edges: {
        Row: {
          id: string;
          workspace_id: string;
          map_id: string;
          source_node_id: string;
          target_node_id: string;
          edge_type: MindMapEdgeType;
          label: string;
          is_directional: boolean;
          metadata: Json;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          map_id: string;
          source_node_id: string;
          target_node_id: string;
          edge_type?: MindMapEdgeType;
          label?: string;
          is_directional?: boolean;
          metadata?: Json;
          created_by?: string;
        };
        Update: {
          source_node_id?: string;
          target_node_id?: string;
          edge_type?: MindMapEdgeType;
          label?: string;
          is_directional?: boolean;
          metadata?: Json;
        };
        Relationships: [];
      };
      daily_shutdowns: {
        Row: {
          id: string;
          workspace_id: string;
          daily_plan_id: string | null;
          shutdown_date: string;
          shipped: string;
          moved_forward: string;
          blocked: string;
          resume_tomorrow: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          daily_plan_id?: string | null;
          shutdown_date?: string;
          shipped?: string;
          moved_forward?: string;
          blocked?: string;
          resume_tomorrow?: string;
          created_by?: string;
        };
        Update: {
          daily_plan_id?: string | null;
          shutdown_date?: string;
          shipped?: string;
          moved_forward?: string;
          blocked?: string;
          resume_tomorrow?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_shutdowns_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_shutdowns_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_shutdowns_workspace_id_created_by_fkey";
            columns: ["workspace_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
          {
            foreignKeyName: "daily_shutdowns_daily_plan_id_workspace_id_fkey";
            columns: ["daily_plan_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "daily_plans";
            referencedColumns: ["id", "workspace_id"];
          },
        ];
      };
      private_reflections: {
        Row: {
          id: string;
          workspace_id: string;
          reflection_date: string;
          title: string;
          body: string;
          mood: string;
          tags: string[];
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          reflection_date?: string;
          title?: string;
          body?: string;
          mood?: string;
          tags?: string[];
          created_by?: string;
        };
        Update: {
          reflection_date?: string;
          title?: string;
          body?: string;
          mood?: string;
          tags?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "private_reflections_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "private_reflections_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "private_reflections_workspace_id_created_by_fkey";
            columns: ["workspace_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
        ];
      };
      dashboard_widget_preferences: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          widget_key: string;
          is_visible: boolean;
          sort_order: number;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id?: string;
          widget_key: string;
          is_visible?: boolean;
          sort_order?: number;
          settings?: Json;
        };
        Update: {
          widget_key?: string;
          is_visible?: boolean;
          sort_order?: number;
          settings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "dashboard_widget_preferences_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dashboard_widget_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dashboard_widget_preferences_workspace_id_user_id_fkey";
            columns: ["workspace_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
        ];
      };
      signals: {
        Row: {
          id: string;
          workspace_id: string;
          recipient_id: string;
          actor_id: string | null;
          kind: SignalKind;
          work_item_id: string | null;
          note_id: string | null;
          comment_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      convert_meeting_action_item_to_task: {
        Args: {
          p_action_item_id: string;
          p_workspace_id: string;
          p_project_id: string;
        };
        Returns: Json;
      };
      create_meeting_note_with_actions: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_title: string;
          p_meeting_date: string;
          p_attendees: string[];
          p_discussion: string;
          p_decisions: string;
          p_risks: string;
          p_action_items?: Json;
        };
        Returns: Json;
      };
      convert_mind_map_node: {
        Args: {
          p_node_id: string;
          p_workspace_id: string;
          p_project_id: string | null;
          p_converted_type: MindMapConvertedObjectType;
        };
        Returns: Json;
      };
      replace_mind_map_graph: {
        Args: {
          p_map_id: string;
          p_workspace_id: string;
          p_title: string;
          p_description: string;
          p_default_view: MindMapView;
          p_nodes?: Json;
          p_edges?: Json;
        };
        Returns: Json;
      };
      create_personal_workspace: {
        Args: {
          workspace_name?: string | null;
        };
        Returns: string;
      };
      create_workspace_invitation: {
        Args: {
          target_workspace_id: string;
          target_email: string;
          target_role?: WorkspaceRole;
        };
        Returns: Database["public"]["Tables"]["workspace_invitations"]["Row"];
      };
      preview_workspace_invitation: {
        Args: { invitation_token: string };
        Returns: Array<{
          workspace_name: string;
          invited_by_name: string;
          email: string;
          is_expired: boolean;
          is_accepted: boolean;
        }>;
      };
      accept_workspace_invitation: {
        Args: { invitation_token: string };
        Returns: string;
      };
      find_unlinked_mentions: {
        Args: { target_kind: string; target_id: string };
        Returns: Array<{ note_id: string; title: string; note_type: NoteType }>;
      };
      create_workspace: {
        Args: {
          workspace_name: string;
        };
        Returns: string;
      };
    };
  };
}
