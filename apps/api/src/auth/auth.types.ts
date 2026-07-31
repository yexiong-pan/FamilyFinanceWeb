export interface AuthenticatedUser {
  userId: string;
  familyId: string;
  memberId: string;
  email: string;
  displayName: string;
  avatarData?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AcceptInvitationInput extends LoginInput {
  invitationCode: string;
}
