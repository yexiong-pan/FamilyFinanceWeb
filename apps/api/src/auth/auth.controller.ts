import { Body, Controller, Get, Inject, Patch, Post, Req, Res } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";
import { readCookie } from "./auth.guard";
import type { AcceptInvitationInput, AuthenticatedUser, AuthRequestContext, LoginInput } from "./auth.types";

const COOKIE = "family_finance_session";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Get("health")
  health() { return { ok: true }; }

  @Public()
  @Post("login")
  async login(
    @Body() input: LoginInput,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse
  ) {
    const result = await this.authService.login(input, requestContext(request));
    setSessionCookie(response, request, result.token);
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
    response.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieAttribute(request)}`);
    return { ok: true };
  }

  @Post("invitations")
  invite(
    @Req() request: IncomingMessage & { user: AuthenticatedUser },
    @Body() input: { memberId: string }
  ) { return this.authService.createInvitation(request.user, input.memberId); }

  @Public()
  @Post("invitations/accept")
  async accept(
    @Body() input: AcceptInvitationInput,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse
  ) {
    const result = await this.authService.acceptInvitation(input, requestContext(request));
    setSessionCookie(response, request, result.token);
    return { user: result.user };
  }
}

function setSessionCookie(response: ServerResponse, request: IncomingMessage, token: string) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secureCookieAttribute(request)}`
  );
}

function secureCookieAttribute(request: IncomingMessage): string {
  const forced = process.env.AUTH_COOKIE_SECURE;
  if (forced === "true") return "; Secure";
  if (forced === "false") return "";
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol?.split(",")[0];
  return protocol?.trim() === "https" ? "; Secure" : "";
}

function requestContext(request: IncomingMessage): AuthRequestContext {
  return { sourceIp: readClientIp(request) };
}

function readClientIp(request: IncomingMessage): string {
  const forwarded = request.headers["cf-connecting-ip"] ?? request.headers["x-forwarded-for"];
  const candidate = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
    ?? request.socket.remoteAddress
    ?? "unknown";
  return candidate.startsWith("::ffff:") ? candidate.slice(7) : candidate;
}
