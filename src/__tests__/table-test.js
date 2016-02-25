import { expect } from 'chai';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLList,
  GraphQLEnumType,
} from 'graphql';
import{
  globalIdField,
} from 'graphql-relay';
import GraphQLDateType from 'graphql-custom-datetype';
import Joi from 'joi';
import { Table } from 'nothinkdb';
import {
  getGraphQLFieldsFromTable,
  joiToGraphQLJoiType,
} from '../table';
import {
  GraphQLJoiType,
} from '../type';


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

      const fooFields = getGraphQLFieldsFromTable(fooTable);

      expect(fooFields.any.type).to.equal(GraphQLString);
      expect(fooFields.required.type).to.deep.equal(new GraphQLNonNull(GraphQLString));
      expect(fooFields.description).to.have.property('description', 'sample description');
      expect(fooFields.string.type).to.equal(GraphQLString);
      expect(fooFields.float.type).to.equal(GraphQLFloat);
      expect(fooFields.int.type).to.equal(GraphQLInt);
      expect(fooFields.boolean.type).to.equal(GraphQLBoolean);
      expect(fooFields.createdAt.type).to.equal(GraphQLDateType);
      expect(fooFields.array.type).to.deep.equal(new GraphQLList(GraphQLString));
      expect(fooFields.object.type).to.deep.equal(new GraphQLObjectType({
        name: 'object',
        fields: {
          string: fooFields.string,
        },
      }));
      expect(fooFields.enum.type).to.deep.equal(new GraphQLEnumType({
        name: 'enum',
        values: {
          red: { value: 'red' },
          green: { value: 'green' },
          blue: { value: 'blue' },
        },
      }));

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

      const Foo = new GraphQLObjectType({
        name: 'Foo',
        fields: fooFields,
      });

      const Query = new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: {
            type: Foo,
            resolve: () => (sampleData),
          },
        },
      });

      const Schema = new GraphQLSchema({
        query: Query,
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
      expect(JSON.stringify(result.data.foo))
        .to.equal(JSON.stringify(sampleData));
    });

    it('should get graphql fields with custom Joi type', async () => {
      const defaultSchema = {
        id: Joi.string(),
      };

      const scalarSchema = joiToGraphQLJoiType({
        email: Joi.string().email(),
      });

      const fooTable = new Table({
        tableName: 'foo',
        schema: () => {
          return {
            ...defaultSchema,
            ...scalarSchema,
          };
        },
      });

      const fooFields = getGraphQLFieldsFromTable(fooTable);
      const GraphQLEmailType = new GraphQLJoiType({
        name: 'email',
        schema: Joi.string().email(),
      });

      expect(fooFields.email.type.schema.meta)
        .to.deep.equal(GraphQLEmailType.schema.meta);

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            echo: {
              type: GraphQLString,
              args: {
                email: { type: GraphQLEmailType },
              },
              resolve: (root, {email}) => {
                return email;
              },
            },
          },
        }),
      });

      const query = `
        query Welcome {
          echo (email: "hi@example.com")
        }
      `;

      const expected = {
        echo: 'hi@example.com',
      };

      return expect(graphql(schema, query)).to.become({ data: expected });
    });

    it('should get graphql fields with graphql field', async () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          id: Joi.string().meta({ GraphQLField: globalIdField('user')}),
        }),
      });

      const fooFields = getGraphQLFieldsFromTable(fooTable);
      expect(JSON.stringify(fooFields.id))
        .to.deep.equal(JSON.stringify(globalIdField('user')));
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

      const userFields = getGraphQLFieldsFromTable(userTable);
      expect(userFields.contact.type).to.deep.equal(new GraphQLObjectType({
        name: 'contact',
        fields: {
          phone: {
            type: new GraphQLObjectType({
              name: 'phone',
              fields: {
                home: { type: GraphQLString },
                cell: { type: GraphQLString },
              },
            }),
          },
        },
      }));
      expect(userFields.notes.type).to.deep.equal(new GraphQLList(
        new GraphQLObjectType({
          name: 'note',
          fields: {
            from: { type: GraphQLString },
            subject: { type: GraphQLString },
          },
        })
      ));

      const UserType = new GraphQLObjectType({
        name: 'User',
        fields: userFields,
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

      const query = `
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
      `;

      const expected = { user: sampleData };
      return expect(graphql(schema, query)).to.become({ data: expected });
    });
  });
});
