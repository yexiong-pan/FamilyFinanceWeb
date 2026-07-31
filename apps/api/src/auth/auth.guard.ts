import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      Reflect.getMetadata(IS_PUBLIC_KEY, context.getHandler())
      || Reflect.getMetadata(IS_PUBLIC_KEY, context.getClass())
    ) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
    const token = readCookie(request.headers.cookie, "family_finance_session");
    if (!token) throw new UnauthorizedException("请先登录");
    request.user = await this.authService.currentUser(token);
    return true;
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  return header?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}
