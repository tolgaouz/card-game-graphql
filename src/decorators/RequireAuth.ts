import { ERRORS } from '../constants';
import { RequestWithSession } from '../types';

/**
 * Checks for the session for authenticated routes,
 * This decorator can only work when context is used in the
 * resolver method.
 */
export default function RequireAuth() {
  return function (_: unknown, __: unknown, descriptor: PropertyDescriptor) {
    const fn = descriptor.value;
    // eslint-disable-next-line no-param-reassign
    descriptor.value = function (...args: Record<string, unknown>[]) {
      // Since these arguments are coming from the graphql context,
      // Each arg is an object with _extensionStack
      args.forEach((arg: Record<string, unknown>) => {
        // We declared that request object will always be assigned
        // to req, so I can easily check if the current argument is req
        // If the variable name was changing, we could check if any of the
        // arguments is an instance of IncomingMessage, then this would be
        // the request object.
        if (typeof arg === 'object' && 'req' in arg) {
          const { req } = arg;
          if ((req as RequestWithSession).session?.userId == null)
            throw new Error(ERRORS.NOT_AUTHENTICATED);
        }
      });
      return fn.bind(this)(...args);
    };
  };
}
