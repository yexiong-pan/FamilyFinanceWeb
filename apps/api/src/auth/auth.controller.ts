import { Body, Controller, Get, Inject, Patch, Post, Req, Res } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";
import { readCookie } from "./auth.guard";
import type { AcceptInvitationInput, AuthenticatedUser, LoginInput } from "./auth.types";

const COOKIE = "family_finance_session";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Get("health")
  health() { return { ok: true }; }

  @Public()
  @Post("login")
  async login(@Body() input: LoginInput, @Res({ passthrough: true }) response: ServerResponse) {
    const result = await this.authService.login(input);
    setSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Get("me")
  me(@Req() request: IncomingMessage & { user: AuthenticatedUser }) { return { user: request.user }; }

  @Patch("profile")
  updateProfile(
    @Req() request: IncomingMessage & { user: AuthenticatedUser },
    @Body() input: { avatarData?: string | null }
  ) {
    return this.authService.updateProfile(request.user, input);
  }

  @Post("logout")
  async logout(@Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse) {
    await this.authService.logout(readCookie(request.headers.cookie, COOKIE));
    response.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return { ok: true };
  }

  @Post("invitations")
  invite(
    @Req() request: IncomingMessage & { user: AuthenticatedUser },
    @Body() input: { memberId: string }
  ) { return this.authService.createInvitation(request.user, input.memberId); }

  @Public()
  @Post("invitations/accept")
  async accept(@Body() input: AcceptInvitationInput, @Res({ passthrough: true }) response: ServerResponse) {
    const result = await this.authService.acceptInvitation(input);
    setSessionCookie(response, result.token);
    return { user: result.user };
  }
}

function setSessionCookie(response: ServerResponse, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure}`);
}
