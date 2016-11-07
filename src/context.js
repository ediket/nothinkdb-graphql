/* eslint no-param-reassign: 0, no-shadow: 0 */
import _ from 'lodash';

export function getFieldsFromContext(info, fieldASTs) {
  if (!info) {
    return {};
  }

  fieldASTs = fieldASTs || info.fieldASTs;

  // for recursion
  // Fragments doesn't have many sets
  let asts = fieldASTs;
  if (!Array.isArray(asts)) {
    asts = [asts];
  }

  // get all selectionSets
  const selections = asts.reduce((selections, source) => {
    if (source.selectionSet) {
      selections.push(...source.selectionSet.selections);
    }

    return selections;
  }, []);

  // return fields
  return selections.reduce((list, ast) => {
    const {name, kind} = ast;

    switch (kind) {
    case 'Field':
      const fields = getFieldsFromContext(info, ast);
      return {
        ...list,
        [name.value]: !_.isEmpty(fields) ? fields : true,
      };
    case 'InlineFragment':
      return {
        ...list,
        ...getFieldsFromContext(info, ast),
      };
    case 'FragmentSpread':
      return {
        ...list,
        ...getFieldsFromContext(info, info.fragments[name.value]),
      };
    default:
      throw new Error('Unsuported query selection');
    }
  }, {});
}

export function getRelationsFromFields(fields) {
  const relationFields = _.omitBy(fields, field => !_.isObject(field));

  if (_.isEmpty(relationFields)) {
    return true;
  }

  return _.mapValues(relationFields,
    relationFields => getRelationsFromFields(relationFields));
}
