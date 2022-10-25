import { Request, Response } from 'express';
import { GraphQLError } from 'graphql';
import { EntityManager } from 'typeorm';
import { User } from './entities/User.entity';

export type RequestWithSession = Request & { session: { userId: number } };

export interface GraphQLContext {
  req: RequestWithSession;
  user?: User;
  res: Response;
  db: EntityManager;
}

export interface FormattedError {
  message: GraphQLError['message'];
  detail?: string;
  path: GraphQLError['path'];
  validationErrors?: Record<string, unknown>[];
}
