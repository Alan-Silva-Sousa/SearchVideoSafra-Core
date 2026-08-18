import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AccessGroupService } from '../access/access-group.service';
import { ActionPermissionService } from '../access/action-permission.service';
import { AuditService } from '../audit/audit.service';
import { AuditRequest } from '../audit/audit.types';

@ApiTags('Autenticação')
@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    private accessGroupService: AccessGroupService,
    private actionPermissions: ActionPermissionService,
    private auditService: AuditService,
  ) {}

  @Get('auth/config')
  @ApiOperation({
    summary: 'Configuração de autenticação',
    description: 'Retorna a URL de autenticação do Genesys Cloud',
  })
  @ApiResponse({ status: 200, description: 'Configuração retornada' })
  getAuthConfig() {
    return this.authService.getAuthConfig();
  }

  @Get('auth/genesys/callback')
  @ApiOperation({
    summary: 'Callback OAuth Genesys',
    description:
      'Processa o callback do Genesys Cloud e redireciona para o frontend',
  })
  @ApiQuery({
    name: 'code',
    description: 'Authorization code do OAuth',
    required: true,
  })
  @ApiQuery({
    name: 'state',
    description: 'Estado assinado do fluxo OAuth',
    required: true,
  })
  @ApiResponse({
    status: 302,
    description: 'Redireciona para o callback do frontend',
  })
  async genesysCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() request: AuditRequest,
    @Res() response: Response,
  ) {
    const frontUrl = (process.env.FRONT_URL || 'http://localhost:5173').replace(
      /\/$/,
      '',
    );

    try {
      if (!code || !state) {
        throw new Error('Code e state são obrigatórios');
      }

      const result = await this.authService.handleGenesysCallback(code, state);
      await this.auditService.record(request, {
        action: 'LOGIN_SUCCESS',
        result: 'SUCCESS',
        user: {
          sub: result.userId,
          email: result.email,
          externalId: result.externalId,
          perfil: result.perfil,
          genesysGroupIds: result.genesysGroupIds,
        },
      });
      response.cookie('searchaudio_token', result.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
      const fragment = new URLSearchParams({
        token: result.token,
        email: result.email,
        displayName: result.displayName || '',
      });
      return response.redirect(
        `${frontUrl}/#/auth/callback?${fragment.toString()}`,
      );
    } catch (error: unknown) {
      await this.auditService.record(request, {
        action: 'LOGIN_FAILURE',
        result: 'FAILURE',
        details: { reason: 'GENESYS_OAUTH_FAILED' },
      });
      const message =
        error instanceof Error ? error.message : 'Erro de autenticação';
      const fragment = new URLSearchParams({ error: message });
      return response.redirect(
        `${frontUrl}/#/auth/callback?${fragment.toString()}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/session')
  async getSession(
    @Req()
    request: Request & {
      user: { genesysGroupIds?: string[] } & Record<string, unknown>;
    },
  ) {
    const accessGroups = await this.accessGroupService.findAuthorizedGroups(
      request.user?.genesysGroupIds || [],
    );
    const genesysGroupIds = request.user?.genesysGroupIds || [];
    return {
      authenticated: true,
      user: request.user,
      accessGroups,
      permissions: {
        canDownload: this.actionPermissions.canDownload(genesysGroupIds),
        canReadAudit: this.actionPermissions.canReadAudit(genesysGroupIds),
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/access-groups')
  @ApiOperation({
    summary: 'Grupos de acesso autorizados',
    description:
      'Retorna os access_groups do usuário logado via PKCE (IDs de grupo Genesys mapeados no banco canônico)',
  })
  async getAccessGroups(
    @Req() request: Request & { user?: { genesysGroupIds?: string[] } },
  ) {
    const accessGroups = await this.accessGroupService.findAuthorizedGroups(
      request.user?.genesysGroupIds || [],
    );
    return { accessGroups };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('auth/me')
  getCurrentUser(@Req() request: Request & { user: Record<string, unknown> }) {
    return request.user;
  }
}
