export type Profile = {
  id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null;
};
export type VideoPost = {
  id: string; user_id: string; caption: string; video_url: string; thumbnail_url: string | null;
  created_at: string; profiles?: Profile; likes_count?: number; comments_count?: number; liked_by_me?: boolean;
};
export type Comment = {
  id: string; video_id: string; user_id: string; body: string; image_url: string | null;
  gif_url: string | null; created_at: string; profiles?: Profile;
};