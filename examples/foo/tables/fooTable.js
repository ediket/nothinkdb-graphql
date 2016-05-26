import Joi from 'joi';
import { Table, schema } from 'nothinkdb';

const fooTable = new Table({
  tableName: 'Foo',
  schema: () => ({
    id: schema.id,
    createdAt: schema.createdAt,
    bar: Joi.string(),
  }),
});

export default fooTable;
