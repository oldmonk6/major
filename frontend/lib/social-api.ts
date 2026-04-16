export const socialApiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type SocialUser = {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  followers_count: number;
  following_count: number;
  active_days: number;
  current_streak_days: number;
  is_following: boolean;
  is_self: boolean;
};

export type SocialCommunity = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  owner?: {
    id?: string | null;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  member_count: number;
  is_member: boolean;
  members_preview?: SocialUser[];
};

export type SocialMessage = {
  id: string;
  conversationId?: string;
  communityId?: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl?: string | null;
  content: string;
  imageUrl?: string | null;
  createdAt?: string | null;
  seen?: boolean;
  seenAt?: string | null;
};

export type ConversationListItem = {
  id: string;
  partner: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
  };
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_sender_id?: string | null;
  unread_count: number;
};

export type PaginatedResponse<T> = {
  page: number;
  page_size: number;
  has_more: boolean;
  items: T[];
};

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("reclaim_token") || "";
}

export function socialHeaders(token?: string): HeadersInit {
  const resolvedToken = token || getToken();
  return {
    "Content-Type": "application/json",
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
  };
}

export async function socialFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${socialApiBase}${path}`, {
    ...options,
    headers: {
      ...socialHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Request failed");
  }
  return data as T;
}
