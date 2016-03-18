import { expect } from 'chai';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
} from 'graphql';
import{
  globalIdField,
} from 'graphql-relay';
import Joi from 'joi';
import { Table } from 'nothinkdb';
import {
  getGraphQLFieldsFromTable,
  joiToGraphQLJoiType,
} from '../field';


describe('table', () => {
  describe('getGraphQLFieldsFromTable', () => {
    it('should get graphql fields from table', async () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          any: Joi.any(),
          required: Joi.any().required(),
          description: Joi.any().description('sample description'),
          string: Joi.string(),
          float: Joi.number(),
          int: Joi.number().integer(),
          boolean: Joi.boolean(),
          createdAt: Joi.date(),
          array: Joi.array().items(Joi.string()),
          object: Joi.object().keys({
            string: Joi.string(),
          }),
          enum: Joi.any().valid(['red', 'green', 'blue']),
        }),
      });

      const Foo = new GraphQLObjectType({
        name: 'Foo',
        fields: getGraphQLFieldsFromTable(fooTable),
      });

      const sampleData = {
        any: 'any',
        required: 'required',
        description: 'description',
        string: 'string',
        float: 0.1,
        int: 1,
        boolean: false,
        createdAt: new Date(),
        array: ['string'],
        object: {
          string: 'string',
        },
        enum: 'red',
      };

      const Schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: Foo,
              resolve: () => (sampleData),
            },
          },
        }),
      });

      const result = await graphql(Schema, `
        query {
          foo {
            any
            required
            description
            string
            float
            int
            boolean
            createdAt
            array
            object {
              string
            }
            enum
          }
        }
      `);

      expect(result.errors).to.be.empty;
      expect(result.data.foo).to.deep.equal(sampleData);
    });

    it('should get graphql fields with custom Joi type', async () => {
      const scalarSchema = joiToGraphQLJoiType({
        email: Joi.string().email(),
      });

      const fooTable = new Table({
        tableName: 'foo',
        schema: () => {
          return {
            email: scalarSchema.email,
          };
        },
      });

      const Foo = new GraphQLObjectType({
        name: 'Foo',
        fields: getGraphQLFieldsFromTable(fooTable),
      });

      const sampleData = {
        email: 'adbc@email.com',
      };

      const Schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: Foo,
              resolve: () => (sampleData),
            },
          },
        }),
      });

      const result = await graphql(Schema, `
        query {
          foo {
            email
          }
        }
      `);

      expect(result.errors).to.be.empty;
      expect(result.data.foo).to.not.equal(sampleData);
    });

    it('should get nodeIdField', async () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => {
          return {
            id: Joi.string(),
          };
        },
      });

      const Foo = new GraphQLObjectType({
        name: 'Foo',
        fields: getGraphQLFieldsFromTable(fooTable),
      });

      const sampleData = {
        id: '21321',
      };

      const Schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: Foo,
              resolve: () => (sampleData),
            },
          },
        }),
      });

      const result = await graphql(Schema, `
        query {
          foo {
            id
          }
        }
      `);

      expect(result.errors).to.be.empty;
      expect(result.data.foo).to.not.equal(sampleData);
    });

    it('should get graphql fields with graphql field', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          id: Joi.string().meta({ GraphQLField: globalIdField('user')}),
        }),
      });

      const fooFields = getGraphQLFieldsFromTable(fooTable);
      expect(JSON.stringify(fooFields.id)).to.equal(JSON.stringify(globalIdField('user')));
    });

    it('should get graphql fields with nested Joi schema', async () => {
      const userTable = new Table({
        tableName: 'user',
        schema: () => ({
          contact: Joi.object().keys({
            phone: {
              home: Joi.string(),
              cell: Joi.string(),
            },
          }),
          notes: Joi.array().items(
            Joi.object().keys({
              from: Joi.string(),
              subject: Joi.string(),
            }).unit('note')
          ),
        }),
      });

      const UserType = new GraphQLObjectType({
        name: 'User',
        fields: getGraphQLFieldsFromTable(userTable),
      });

      const sampleData = {
        contact: {
          phone: {
            home: '010-111-1111',
            cell: '02-11-111',
          },
        },
        notes: [
          {
            from: 'john',
            subject: 'hi',
          },
        ],
      };

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            user: {
              type: UserType,
              resolve: () => sampleData,
            },
          },
        }),
      });

      const result = await graphql(schema, `
        query {
          user {
            contact {
              phone {
                home
                cell
              }
            }
            notes {
              from
              subject
            }
          }
        }
      `);

      expect(result.data.user).to.deep.equal(sampleData);
    });
  });
});
