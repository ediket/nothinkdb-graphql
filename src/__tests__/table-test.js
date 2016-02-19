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
} from 'graphql';
import Joi from 'joi';
import { Table } from 'nothinkdb';
import {
  getGraphQLFieldsFromTable,
} from '../table';


describe('table', () => {
  describe('getGraphQLFieldsFromTable', () => {
    it('should get graphql fields from table', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          any: Joi.any(),
          required: Joi.any().required(),
          description: Joi.any().description('sample description'),
          string: Joi.string(),
          float: Joi.number(),
          int: Joi.number().integer(),
          boolean: Joi.boolean(),
          array: Joi.array().items(Joi.string()),
          object: Joi.object().keys({
            string: Joi.string(),
          }),
          enum: Joi.any().valid([]),
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
      expect(fooFields.array.type).to.deep.equal(new GraphQLList(GraphQLString));
      expect(fooFields.object.type).to.deep.equal(new GraphQLObjectType({
        name: 'object',
        fields: {
          string: fooFields.string,
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
        array: ['string'],
        object: {
          string: 'string',
        },
        enum: 'a',
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
            array
            object {
              string
            }
            enum
          }
        }
      `);

      expect(result.errors).to.be.empty;
      expect(result.data.foo).deep.equal(sampleData);
    });
  });
});
