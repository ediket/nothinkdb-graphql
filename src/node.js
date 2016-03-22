import _ from 'lodash';
import {
  nodeDefinitions as relayNodeDefinitions,
  fromGlobalId,
} from 'graphql-relay';

export function nodeDefinitions({ connect }) {
  const resolvers = {};

  function hasType(typeName) {
    return _.has(resolvers, typeName);
  }

  function registerType({ type, table }) {
    if (hasType(type.name)) return;
    resolvers[type.name] = { type, table };
  }

  async function resolveObj(globalId) {
    const { type: typeName, id } = fromGlobalId(globalId);

    if (!hasType(typeName)) return null;

    const { table } = resolvers[typeName];

    const connection = await connect();
    const obj = await table.get(id).run(connection);
    await connection.close();

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
