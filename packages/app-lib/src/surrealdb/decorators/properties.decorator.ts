export const formatMetadataKey = Symbol('Properties');

/**
 * Properties
 * @param props
 */
export const Properties = (props?: {
  fieldName?: string;
  // if one or more returnField is defined in one property, default DecoratedProperties.queryReturnFields is override by the returnField's
  // ex [ "n.title AS title","n.name AS name" ] vs default ["n"]
  returnField?: boolean;
  map?: object[];
  transform?: (...args: any[]) => any;
}) => {
  return Reflect.metadata(formatMetadataKey, props);
};

/**
 * getProperties
 * @param target
 * @param propertyKey
 */
export const getProperties = (target: any, propertyKey: string) => {
  return Reflect.getMetadata(formatMetadataKey, target, propertyKey);
};