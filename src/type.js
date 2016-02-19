import { GraphQLScalarType, GraphQLError } from 'graphql';
import assert from 'assert';
import _ from 'lodash';
import Joi from 'Joi';

export class GraphQLJoiType extends GraphQLScalarType {
  constructor(options = {}) {
    const { name, schema } = options;
    const { _description: description } = schema;
    assert(!_.isEmpty(name), 'required name argument');
    assert(schema.isJoi, 'joi schema required');
    super({
      name,
      description,
      serialize: value => value,
      parseValue: value => value,
      parseLiteral: ast => {
        let value;
        try {
          value = Joi.attempt(ast.value, schema);
        } catch (err) {
          throw new GraphQLError(err.message);
        }
        return value;
      },
    });
    this.schema = schema;
  }
}
