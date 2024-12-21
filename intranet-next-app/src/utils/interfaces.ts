export interface DBUser {
  id: string;
  created_at: string;
  name: string;
  email: string;
  room: string;
  is_admin: boolean;
}

export interface User {
  name: string;
  email: string;
  room: string;
  is_admin: boolean;
}
