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

    it('should get graphql fields with custom Joi type', async () => {
      const schema = {
        id: Joi.string(),
      };

      const scalarSchema = joiToGraphQLJoiType({
        email: Joi.string().email(),
      });

      const fooTable = new Table({
        table: 'foo',
        schema: () => {
          return {
            ...schema,
            ...scalarSchema,
          };
        },
      });

      const fooFields = getGraphQLFieldsFromTable(fooTable);
      const expectedType = new GraphQLJoiType({
        name: 'email',
        schema: Joi.string().email(),
      });

      expect(fooFields.id.type).to.equal(GraphQLString);
      expect(fooFields.email.type.name)
        .to.equal(expectedType.name);
      expect(fooFields.email.type.schema.meta)
        .to.deep.equal(expectedType.schema.meta);
    });
  });
});
