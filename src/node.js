import _ from 'lodash';
import {
  nodeDefinitions as relayNodeDefinitions,
  fromGlobalId,
} from 'graphql-relay';

export function nodeDefinitions() {
  const resolvers = {};

  function hasType(typeName) {
    return _.has(resolvers, typeName);
  }

  function registerType({ type, resolve }) {
    if (hasType(type.name)) return;

    resolvers[type.name] = {
      type,
      resolve,
    };
  }

  async function resolveObj(globalId) {
    const { type: typeName, id } = fromGlobalId(globalId);

    if (!hasType(typeName)) return null;

    const { resolve } = resolvers[typeName];

    const obj = await resolve(id);
    if (_.isNull(obj)) return null;

    obj._dataType = typeName;
    return obj;
  }

  function resolveType(obj) {
    if (_.isNull(obj)) return null;
    const { type } = resolvers[obj._dataType];
    return type;
  }

  const {
    nodeInterface,
    nodeField,
  } = relayNodeDefinitions(resolveObj, resolveType);

  return {
    registerType,
    nodeInterface,
    nodeField,
  };
}
