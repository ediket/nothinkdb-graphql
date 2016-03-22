import { expect } from 'chai';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
} from 'graphql';
import{
  toGlobalId,
} from 'graphql-relay';
import r from 'rethinkdb';
import { Environment } from 'nothinkdb';
import Joi from 'joi';
import {
  getGraphQLFieldsFromTable,
} from '../field';
import {
  nodeDefinitions,
} from '../node';

const USER_ID1 = '1';

describe('node', () => {
  let connection;
  let schema;
  let userTable;

  before(async () => {
    connection = await r.connect({});
    await r.branch(r.dbList().contains('test').not(), r.dbCreate('test'), null).run(connection);

    const environment = new Environment({});

    userTable = environment.createTable({
      tableName: 'User',
      schema: () => ({
        id: Joi.string(),
        name: Joi.string(),
      }),
    });
    await environment.sync(connection);

    await userTable.insert(
      userTable.create({ id: USER_ID1, name: 'John Doe' })
    ).run(connection);

    const { nodeField, nodeInterface, registerType } = nodeDefinitions();

    const userType = new GraphQLObjectType({
      name: userTable.tableName,
      fields: getGraphQLFieldsFromTable(userTable),
      interfaces: [nodeInterface],
    });

    registerType({
      type: userType,
      resolve: async (id) => {
        const _connection = await r.connect();
        const user = await userTable.get(id).run(_connection);
        await _connection.close();
        return user;
      },
    });

    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: () => ({
        node: nodeField,
      }),
    });

    schema = new GraphQLSchema({
      query: queryType,
    });
  });

  after(async () => {
    await userTable.query().delete().run(connection);
    await connection.close();
  });

  describe('nodeDefinitions', () => {
    it('should return nodeField, nodeInterface property', () => {
      expect(nodeDefinitions())
        .to.have.all.keys(['nodeField', 'nodeInterface', 'registerType']);
    });

    it(`gets the correct ID for users`, () => {
      const globalId = toGlobalId(userTable.tableName, USER_ID1);
      const query = `
        query {
          node(id: "${globalId}") {
            id
          }
        }
      `;
      const expected = {
        node: {
          id: globalId,
        },
      };
      return expect(graphql(schema, query)).to.become({ data: expected });
    });

    it('gets the correct name for users', () => {
      const globalId = toGlobalId(userTable.tableName, USER_ID1);
      const query = `{
        node(id: "${globalId}") {
          id
          ... on User {
            name
          }
        }
      }`;
      const expected = {
        node: {
          id: globalId,
          name: 'John Doe',
        },
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });

    it('gets the correct type name for users', () => {
      const globalId = toGlobalId(userTable.tableName, USER_ID1);
      const query = `{
        node(id: "${globalId}") {
          id
          __typename
        }
      }`;
      const expected = {
        node: {
          id: globalId,
          __typename: userTable.tableName,
        },
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });

    it('returns null for bad IDs', () => {
      const query = `{
        node(id: "hi") {
          id
        }
      }`;
      const expected = {
        node: null,
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });

    it('returns null for not exist node in nodes', () => {
      const globalId = toGlobalId('post', 1);
      const query = `{
        node(id: "${globalId}") {
          id
        }
      }`;
      const expected = {
        node: null,
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });

    it('returns null for not exist data in table', () => {
      const globalId = toGlobalId(userTable.tableName, 3);
      const query = `{
        node(id: "${globalId}") {
          id
        }
      }`;
      const expected = {
        node: null,
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });

    it('has correct node interface', () => {
      const query = `{
        __type(name: "Node") {
          name
          kind
          fields {
            name
            type {
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }`;
      const expected = {
        __type: {
          name: 'Node',
          kind: 'INTERFACE',
          fields: [
            {
              name: 'id',
              type: {
                kind: 'NON_NULL',
                ofType: {
                  name: 'ID',
                  kind: 'SCALAR',
                },
              },
            },
          ],
        },
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });

    it('has correct node root field', () => {
      const query = `{
        __schema {
          queryType {
            fields {
              name
              type {
                name
                kind
              }
              args {
                name
                type {
                  kind
                  ofType {
                    name
                    kind
                  }
                }
              }
            }
          }
        }
      }`;
      const expected = {
        __schema: {
          queryType: {
            fields: [
              {
                name: 'node',
                type: {
                  name: 'Node',
                  kind: 'INTERFACE',
                },
                args: [
                  {
                    name: 'id',
                    type: {
                      kind: 'NON_NULL',
                      ofType: {
                        name: 'ID',
                        kind: 'SCALAR',
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });
  });
});
