import { expect } from 'chai';
import r from 'rethinkdb';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
} from 'graphql';
import{
  globalIdField,
  toGlobalId,
} from 'graphql-relay';
import { Table } from 'nothinkdb';
import Joi from 'joi';
import {
  getGraphQLFieldsFromTable,
} from '../table';
import {
  nodeDefinitionsFromTables,
} from '../node';

const USER_ID1 = '1';
const USER_ID2 = '2';
const TABLE_NAME = 'User';

describe('node', () => {
  describe('nodeDefinitionsFromTables', async () => {
    const connection = await r.connect({});
    await r.branch(r.dbList().contains('test').not(), r.dbCreate('test'), null).run(connection);
    r.dbCreate('test');
    await r.branch(r.tableList().contains(TABLE_NAME).not(), r.tableCreate(TABLE_NAME), null).run(connection);

    const userTable = new Table({
      table: TABLE_NAME,
      schema: () => ({
        id: Joi.string().meta({ GraphQLType: globalIdField(TABLE_NAME)}),
        name: Joi.string(),
      }),
    });
    await userTable.sync(connection);

    const john = await userTable.create({
      id: USER_ID1,
      name: 'John Doe',
    });
    const jane = await userTable.create({
      id: USER_ID2,
      name: 'Jane Smith',
    });
    await userTable.insert([john, jane]).run(connection);

    const { nodeField, nodeInterface } = nodeDefinitionsFromTables({
      user: {
        table: userTable,
        getGraphQLType: () => userType,
      },
    });
    const userType = new GraphQLObjectType({
      name: TABLE_NAME,
      fields: getGraphQLFieldsFromTable(userTable),
      interfaces: [nodeInterface],
    });
    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: () => ({
        node: nodeField,
      }),
    });

    const Schema = new GraphQLSchema({
      query: queryType,
    });

    after(async () => {
      await r.table(TABLE_NAME).delete().run(connection);
      await connection.close();
    });

    it('should return nodeField, nodeInterface property', async () => {
      expect(nodeDefinitionsFromTables([]))
        .to.have.all.keys(['nodeField', 'nodeInterface']);
    });

    it(`gets the correct ID for users`, async () => {
      const globalId = toGlobalId('user', USER_ID1);
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
      return expect(graphql(Schema, query)).to.become({ data: expected });
    });

    it('gets the correct name for users', () => {
      const globalId = toGlobalId('user', USER_ID1);
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

      return expect(graphql(Schema, query)).to.become({data: expected});
    });

    it('gets the correct type name for users', () => {
      const globalId = toGlobalId('user', USER_ID1);
      const query = `{
        node(id: "${globalId}") {
          id
          __typename
        }
      }`;
      const expected = {
        node: {
          id: globalId,
          __typename: TABLE_NAME,
        },
      };

      return expect(graphql(Schema, query)).to.become({data: expected});
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

      return expect(graphql(Schema, query)).to.become({data: expected});
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

      return expect(graphql(Schema, query)).to.become({data: expected});
    });

    it('returns null for not exist data in table', () => {
      const globalId = toGlobalId('user', 3);
      const query = `{
        node(id: "${globalId}") {
          id
        }
      }`;
      const expected = {
        node: null,
      };

      return expect(graphql(Schema, query)).to.become({data: expected});
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

      return expect(graphql(Schema, query)).to.become({data: expected});
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

      return expect(graphql(Schema, query)).to.become({data: expected});
    });
  });
});
