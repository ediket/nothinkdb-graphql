import _ from 'lodash';
import {
  nodeDefinitions as relayNodeDefinitions,
  fromGlobalId,
} from 'graphql-relay';

export function nodeDefinitions({ connect }) {
  const resolvers = {};

  function hasType(type) {
    return _.has(resolvers, type);
  }

  function registerType({ type, table, assert = async () => {} }) {
    if (hasType(type.name)) return;
    resolvers[type.name] = { type, table, assert };
  }

  async function resolveObj(globalId) {
    const { type, id } = fromGlobalId(globalId);

    if (!hasType(type)) return null;

    const { table, assert } = resolvers[type];

    await assert(id);

    const connection = await connect();
    const obj = await table.get(id).run(connection);
    await connection.close();

    if (_.isNull(obj)) return null;

    obj._dataType = type;
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
