// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { isThenable, MaybePromise, PothosOutputFieldConfig, SchemaTypes } from '../core/index.ts';
import { ForbiddenError } from './errors.ts';
import RequestCache from './request-cache.ts';
import ResolveState from './resolve-state.ts';
import { ResolveStep, UnauthorizedResolver } from './types.ts';
import { PothosScopeAuthPlugin, UnauthorizedErrorFn } from './index.ts';
const defaultUnauthorizedResolver: UnauthorizedResolver<never, never, never, never, never> = (_root, _args, _context, _info, error) => {
    throw error;
};
export function resolveHelper<Types extends SchemaTypes>(steps: ResolveStep<Types>[], plugin: PothosScopeAuthPlugin<Types>, fieldConfig: PothosOutputFieldConfig<Types>) {
    const unauthorizedResolver = fieldConfig.pothosOptions.unauthorizedResolver ?? defaultUnauthorizedResolver;
    const createError: UnauthorizedErrorFn<Types, object, {}> = fieldConfig.pothosOptions.unauthorizedError ??
        plugin.builder.options.scopeAuthOptions?.unauthorizedError ??
        ((parent, args, context, info, result) => result.message);
    return (parent: unknown, args: {}, context: Types["Context"], info: GraphQLResolveInfo) => {
        const state = new ResolveState(RequestCache.fromContext(context, plugin));
        function runSteps(index: number): MaybePromise<unknown> {
            for (let i = index; i < steps.length; i += 1) {
                const { run, errorMessage } = steps[i];
                const stepResult = run(state, parent, args, context, info);
                if (isThenable(stepResult)) {
                    return stepResult.then((result) => {
                        if (result) {
                            const error = createError(parent as object, args, context, info, {
                                message: typeof errorMessage === "function"
                                    ? errorMessage(parent, args, context, info)
                                    : errorMessage,
                                failure: result,
                            });
                            return unauthorizedResolver(parent as never, args, context as never, info, typeof error === "string" ? new ForbiddenError(error, result) : error);
                        }
                        return runSteps(i + 1);
                    });
                }
                if (stepResult) {
                    const error = createError(parent as object, args, context, info, {
                        message: typeof errorMessage === "function"
                            ? errorMessage(parent, args, context, info)
                            : errorMessage,
                        failure: stepResult,
                    });
                    return unauthorizedResolver(parent as never, args, context as never, info, typeof error === "string" ? new ForbiddenError(error, stepResult) : error);
                }
            }
            return state.resolveValue;
        }
        return runSteps(0);
    };
}
