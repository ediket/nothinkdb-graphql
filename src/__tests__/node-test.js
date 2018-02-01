import { expect } from 'chai';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
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

describe('node - test', () => {
  let connection;
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
  });

  after(async () => {
    await userTable.query().delete().run(connection);
    await connection.close();
  });

  describe('nodeDefinitions - interface', () => {
    let schema;

    before(async () => {
      const { nodeField } = nodeDefinitions({
        connect: () => r.connect({}),
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

    it('should return nodeField, nodeInterface property', () => {
      expect(
        nodeDefinitions({ connect: () => r.connect({}) })
      ).to.have.all.keys(['nodeField', 'nodeInterface', 'registerType']);
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

  describe('nodeDefinitions - register & resolve', () => {
    let schema;

    before(async () => {
      const { nodeField, nodeInterface, registerType } = nodeDefinitions({
        connect: () => r.connect({}),
      });

      const userType = new GraphQLObjectType({
        name: userTable.tableName,
        fields: getGraphQLFieldsFromTable(userTable),
        interfaces: [nodeInterface],
      });

      registerType({
        table: userTable,
        type: userType,
      });

      const queryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          node: nodeField,
        }),
      });

      schema = new GraphQLSchema({
        query: queryType,
        types: [userType],
      });
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
  });

  describe(`nodeDefinitions - registerType with 'assert' option`, () => {
    let schema;

    before(async () => {
      const { nodeField, nodeInterface, registerType } = nodeDefinitions({
        connect: () => r.connect({}),
      });

      const userType = new GraphQLObjectType({
        name: userTable.tableName,
        fields: getGraphQLFieldsFromTable(userTable),
        interfaces: [nodeInterface],
      });

      registerType({
        table: userTable,
        type: userType,
        assert: (/* USER_ID1, context, info */) => { throw new Error(); },
      });

      const queryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          node: nodeField,
        }),
      });

      schema = new GraphQLSchema({
        query: queryType,
        types: [userType],
      });
    });

    it(`should run assert function before resolve`, async () => {
      const globalId = toGlobalId(userTable.tableName, USER_ID1);
      const query = `
        query {
          node(id: "${globalId}") {
            id
          }
        }
      `;
      return expect(await graphql(schema, query)).to.have.property('errors');
    });
  });

  describe(`nodeDefinitions - registerType with 'resolve' option`, () => {
    const MOCK_USER_ID = '2';
    let schema;

    before(async () => {
      const { nodeField, nodeInterface, registerType } = nodeDefinitions({
        connect: () => r.connect({}),
      });

      const userType = new GraphQLObjectType({
        name: userTable.tableName,
        fields: getGraphQLFieldsFromTable(userTable),
        interfaces: [nodeInterface],
      });

      registerType({
        table: userTable,
        type: userType,
        resolve: () => ({ id: MOCK_USER_ID }),
      });

      const queryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          node: nodeField,
        }),
      });

      schema = new GraphQLSchema({
        query: queryType,
        types: [userType],
      });
    });

    it(`should have outcome influencd by resolve.`, async () => {
      const globalId = toGlobalId(userTable.tableName, USER_ID1);
      const mockGlobalId = toGlobalId(userTable.tableName, MOCK_USER_ID);
      const query = `{
        node(id: "${globalId}") {
          id
          __typename
        }
      }`;
      const expected = {
        node: {
          id: mockGlobalId,
          __typename: userTable.tableName,
        },
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });

    it(`should still have its outcome influencd by resolve if node does not exist.`, async () => {
      const nonExistingId = toGlobalId(userTable.tableName, 'USER_ID1');
      const mockGlobalId = toGlobalId(userTable.tableName, MOCK_USER_ID);
      const query = `{
        node(id: "${nonExistingId}") {
          id
          __typename
        }
      }`;
      const expected = {
        node: {
          id: mockGlobalId,
          __typename: userTable.tableName,
        },
      };
      return expect(graphql(schema, query)).to.become({data: expected});
    });
  });

  describe(`nodeDefinitions - registerType with 'afterQuery' option`, () => {
    let schema;

    before(async () => {
      const { nodeField, nodeInterface, registerType } = nodeDefinitions({
        connect: () => r.connect({}),
      });

      const userType = new GraphQLObjectType({
        name: userTable.tableName,
        fields: {
          ...getGraphQLFieldsFromTable(userTable),
          foo: {
            type: GraphQLString,
          },
        },
        interfaces: [nodeInterface],
      });

      registerType({
        table: userTable,
        type: userType,
        afterQuery: query => query.merge({ foo: 'bar' }),
      });

      const queryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          node: nodeField,
        }),
      });

      schema = new GraphQLSchema({
        query: queryType,
        types: [userType],
      });
    });

    it(`should run afterQuery function`, () => {
      const globalId = toGlobalId(userTable.tableName, USER_ID1);
      const query = `
        query {
          node(id: "${globalId}") {
            id
            ...on User {
              foo
            }
          }
        }
      `;
      const expected = {
        node: {
          id: globalId,
          foo: 'bar',
        },
      };
      return expect(graphql(schema, query)).to.become({ data: expected });
    });
  });
});
