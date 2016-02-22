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
    });

    it('should work', async () => {
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
          enum: Joi.any().valid(['red', 'blue']),
        }),
      });

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
        fields: getGraphQLFieldsFromTable(fooTable),
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
      const basicSchema = {
        someStringField: Joi.string(),
      };
      const customSchema = {
        email: Joi.string().email(),
        username: Joi.string().min(3).max(5),
      };
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...basicSchema,
          ...customSchema,
        }),
      });

      const fooFields = getGraphQLFieldsFromTable(fooTable, customSchema);

      expect(fooFields.someStringField.type).to.equal(GraphQLString);
    });

    it('should get graphql fields with custom Joi type', async () => {
      const schema = {
        id: Joi.string(),
        email: Joi.string().email().meta({ isScalar: true }),
        username: Joi.string().min(3).max(5).meta({ isScalar: true }),
      };

      const fooTable = new Table({
        table: 'foo',
        schema: () => schema,
      });

      const fooFields = getGraphQLFieldsFromTable(fooTable);

      expect(fooFields.id.type).to.equal(GraphQLString);
      expect(true).to.be.true;
      expect(JSON.stringify(fooFields.email.type)).to.equal(
        JSON.stringify(new GraphQLJoiType({
          name: 'email',
          schema: schema.email,
        }))
      );
      expect(JSON.stringify(fooFields.username.type)).to.equal(
        JSON.stringify(new GraphQLJoiType({
          name: 'username',
          schema: schema.username,
        }))
      );
    });
  });
});
