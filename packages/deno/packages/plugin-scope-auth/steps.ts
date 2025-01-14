// @ts-nocheck
/* eslint-disable no-param-reassign */
import { GraphQLFieldResolver } from 'https://cdn.skypack.dev/graphql?dts';
import { isThenable, SchemaTypes } from '../core/index.ts';
import { FieldAuthScopes, FieldGrantScopes, ResolveStep, TypeAuthScopes, TypeGrantScopes, } from './types.ts';
// TODO generate useful error messages
export function createTypeAuthScopesStep<Types extends SchemaTypes>(authScopes: TypeAuthScopes<Types, unknown>, type: string): ResolveStep<Types> {
    if (typeof authScopes === "function") {
        return {
            run: (state, parent, args, context, info) => state.evaluateTypeScopeFunction(authScopes, type, parent, info),
            errorMessage: `Not authorized to read fields for ${type}`,
        };
    }
    return {
        run: (state, parent, args, context, info) => state.evaluateScopeMap(authScopes, info),
        errorMessage: `Not authorized to read fields for ${type}`,
    };
}
export function createTypeGrantScopesStep<Types extends SchemaTypes>(grantScopes: TypeGrantScopes<Types, unknown>, type: string, forField: boolean): ResolveStep<Types> {
    return {
        run: (state, parent, args, context, info) => state.cache.grantTypeScopes(type, parent, forField ? info.path.prev : info.path, () => grantScopes(parent, context)),
        errorMessage: `Unknown error creating grants for ${type}`,
    };
}
export function createFieldAuthScopesStep<Types extends SchemaTypes>(authScopes: FieldAuthScopes<Types, {}, {}>): ResolveStep<Types> {
    if (typeof authScopes === "function") {
        return {
            errorMessage: (parent, args, context, info) => `Not authorized to resolve ${info.parentType}.${info.fieldName}`,
            run: (state, parent, args, context, info) => {
                const scopeMap = authScopes(parent as {}, args, context, info);
                if (isThenable(scopeMap)) {
                    return scopeMap.then((resolved) => state.evaluateScopeMap(resolved, info));
                }
                return state.evaluateScopeMap(scopeMap, info);
            },
        };
    }
    return {
        errorMessage: (parent, args, context, info) => `Not authorized to resolve ${info.parentType}.${info.fieldName}`,
        run: (state, parent, args, context, info) => state.evaluateScopeMap(authScopes, info),
    };
}
export function createFieldGrantScopesStep<Types extends SchemaTypes>(grantScopes: FieldGrantScopes<Types, {}, {}>): ResolveStep<Types> {
    return {
        errorMessage: (parent, args, context, info) => `Unknown issue generating grants for ${info.parentType}.${info.fieldName}`,
        run: (state, parent, args, context, info) => {
            if (typeof grantScopes !== "function") {
                state.cache.saveGrantedScopes(grantScopes, info.path);
                return null;
            }
            const result = grantScopes(parent as {}, args, context, info);
            if (isThenable(result)) {
                return result.then((resolved) => {
                    state.cache.saveGrantedScopes(resolved, info.path);
                    return null;
                });
            }
            state.cache.saveGrantedScopes(result, info.path);
            return null;
        },
    };
}
export function createResolveStep<Types extends SchemaTypes>(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>): ResolveStep<Types> {
    return {
        errorMessage: (parent, args, context, info) => `Unknown issue resolving ${info.parentType}.${info.fieldName}`,
        run: (state, parent, args, context, info) => {
            const result: unknown = resolver(parent, args, context, info);
            if (isThenable(result)) {
                return result.then((resolved) => {
                    state.resolveValue = resolved;
                    return null;
                });
            }
            state.resolveValue = result;
            return null;
        },
    };
}
