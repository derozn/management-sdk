import { Field, FieldType } from "./field";
import { MutationMode, PartialBy, RelationType } from "./util";
import { ChangeItem, ChangeListener, MigrationChange } from "./migration";
import { Renderer } from "./renderer";
import {
  GraphQLBatchMigrationCreateEnumerableFieldInput,
  GraphQLBatchMigrationCreateModelInput,
  GraphQLBatchMigrationCreateRelationalFieldInput,
  GraphQLBatchMigrationCreateRemoteFieldInput,
  GraphQLBatchMigrationCreateReverseRelationalFieldInput,
  GraphQLBatchMigrationCreateReverseUnionFieldInput,
  GraphQLBatchMigrationCreateSimpleFieldInput,
  GraphQLBatchMigrationCreateUnionFieldInput,
  GraphQLBatchMigrationUpdateEnumerableFieldInput,
  GraphQLBatchMigrationUpdateModelInput,
  GraphQLBatchMigrationUpdateRelationalFieldInput,
  GraphQLBatchMigrationUpdateSimpleFieldInput,
  GraphQLBatchMigrationUpdateUnionFieldInput,
  GraphQLFieldValidationFloatRangeInput,
  GraphQLFieldValidationIntRangeInput,
  GraphQLFieldValidationRegExInput,
  GraphQLRemoteFieldType,
  GraphQLSimpleFieldType,
  GraphQLSimpleFieldValidationsInput,
} from "./generated/schema";

type ModelArgs =
  | GraphQLBatchMigrationCreateModelInput
  | GraphQLBatchMigrationUpdateModelInput;

/**
 * Relational Fields
 */
interface RelationalFieldArgs
  extends Omit<
    GraphQLBatchMigrationCreateRelationalFieldInput,
    "reverseField"
  > {
  relationType: RelationType;
  model: string;
  reverseField?: Omit<
    GraphQLBatchMigrationCreateReverseRelationalFieldInput,
    "modelApiId" | "isList"
  >;
}

/**
 * Create Union Field
 */
interface CreateUnionFieldArgs
  extends Omit<GraphQLBatchMigrationCreateUnionFieldInput, "reverseField"> {
  relationType: RelationType;
  models: string[];
  reverseField?: Omit<
    GraphQLBatchMigrationCreateReverseUnionFieldInput,
    "modelApiIds" | "isList"
  >;
}

/**
 * Update Union Field
 */
interface UpdateUnionFieldArgs
  extends Omit<GraphQLBatchMigrationUpdateUnionFieldInput, "reverseField"> {
  models?: string[];
}

interface FieldValidationArgs {
  range?: GraphQLFieldValidationFloatRangeInput;
  characters?: GraphQLFieldValidationIntRangeInput;
  listItemCount?: GraphQLFieldValidationIntRangeInput;
  matches?: GraphQLFieldValidationRegExInput;
  notMatches?: GraphQLFieldValidationRegExInput;
}

/**
 * Create Simple Field
 */
interface CreateSimpleFieldArgs
  extends Omit<
    GraphQLBatchMigrationCreateSimpleFieldInput,
    "validations" | "modelApiId"
  > {
  validations?: FieldValidationArgs;
}
/**
 * Create Remote Field
 */
interface CreateRemoteFieldArgs
  extends Omit<
    GraphQLBatchMigrationCreateRemoteFieldInput,
    "modelApiId" | "type"
  > {}

interface UpdateSimpleFieldArgs
  extends Omit<
    GraphQLBatchMigrationUpdateSimpleFieldInput,
    "validations" | "modelApiId"
  > {
  validations?: FieldValidationArgs;
}

/**
 * GraphCMS Model
 */
interface Model {
  /**
   * Add a new field to the model.
   * @param field options for the field.
   */
  addSimpleField(field: CreateSimpleFieldArgs): Model;

  /**
   * Add a new remote field to the model.
   * @param field options for the field.
   */
  addRemoteField(field: CreateRemoteFieldArgs): Model;

  /**
   * Update an existing field
   * @param field options for the field.
   */
  updateSimpleField(field: UpdateSimpleFieldArgs): Model;

  /**
   * Add a relational field
   * @param field options for the relational field.
   */
  addRelationalField(
    field: Omit<
      PartialBy<RelationalFieldArgs, "reverseField" | "type">,
      "modelApiId"
    >
  ): Model;

  /**
   * Update a relational field
   * @param field options for the relational field.
   */
  updateRelationalField(
    field: Omit<GraphQLBatchMigrationUpdateRelationalFieldInput, "modelApiId">
  ): Model;

  /**
   * Add a union field
   * @param field options for the union field.
   */
  addUnionField(
    field: Omit<PartialBy<CreateUnionFieldArgs, "reverseField">, "modelApiId">
  ): Model;

  /**
   * Update a union field.
   * @param field options for the union field.
   */
  updateUnionField(field: Omit<UpdateUnionFieldArgs, "modelApiId">): Model;

  /**
   * Create an enumerable field.
   * @param field options for the enumerable field.
   */
  addEnumerableField(
    field: Omit<GraphQLBatchMigrationCreateEnumerableFieldInput, "modelApiId">
  ): Model;

  /**
   * Update an enumerable field
   * @param field options for the enumerable field.
   */
  updateEnumerableField(
    field: Omit<GraphQLBatchMigrationUpdateEnumerableFieldInput, "modelApiId">
  ): Model;

  /**
   * Delete a field
   * @param apiId the apiId of the field to delete.
   */
  deleteField(apiId: string): void;
}

/**
 * @ignore
 */
class ModelClass implements Model, ChangeItem {
  constructor(
    private listener: ChangeListener,
    private mode: MutationMode,
    private args: ModelArgs
  ) {}

  addSimpleField(fieldArgs: any): Model {
    fieldArgs.modelApiId = this.args.apiId;
    if (fieldArgs.type === GraphQLSimpleFieldType.String) {
      fieldArgs.formRenderer = fieldArgs.formRenderer || Renderer.SingleLine;
    }

    if (fieldArgs.validations) {
      fieldArgs.validations = extractFieldValidations(fieldArgs);
    }

    const field = new Field(fieldArgs, MutationMode.Create);
    this.listener.registerChange(field);
    return this;
  }

  addRemoteField(fieldArgs: any): Model {
    fieldArgs.modelApiId = this.args.apiId;
    fieldArgs.type = GraphQLRemoteFieldType.Remote;
    if (fieldArgs.remoteConfig.headers) {
      if (fieldArgs.remoteConfig.headers.constructor.name !== "Object") {
        throw new Error("Headers in remote config has to be an object");
      }
      for (const [k, v] of Object.entries(fieldArgs.remoteConfig.headers)) {
        // wrap non-array values into arrays
        fieldArgs.remoteConfig.headers[k] = Array.isArray(v) ? v : [v];
      }
    } else {
      fieldArgs.remoteConfig.headers = {};
    }
    fieldArgs.remoteConfig.payloadFieldApiIds =
      fieldArgs.remoteConfig.payloadFieldApiIds || [];
    fieldArgs.remoteConfig.method = fieldArgs.remoteConfig.method || "GET";

    const field = new Field(
      fieldArgs,
      MutationMode.Create,
      FieldType.RemoteField
    );
    this.listener.registerChange(field);
    return this;
  }

  updateSimpleField(fieldArgs: any): Model {
    fieldArgs.modelApiId = this.args.apiId;

    if (fieldArgs.validations) {
      fieldArgs.validations = extractFieldValidations(fieldArgs);
    }

    const { type, ...fieldChanges } = fieldArgs;
    const field = new Field(fieldChanges, MutationMode.Update);
    this.listener.registerChange(field);
    return this;
  }

  addRelationalField(fieldArgs: any): Model {
    fieldArgs.modelApiId = this.args.apiId;
    if (
      (fieldArgs.type && fieldArgs.type === "ASSET") ||
      (fieldArgs.model && fieldArgs.model === "Asset")
    ) {
      fieldArgs.type = "ASSET";
    } else {
      fieldArgs.type = "RELATION";
    }

    if (!fieldArgs.reverseField) {
      fieldArgs.reverseField = {
        apiId: `related${fieldArgs.modelApiId}`,
        displayName: `Related ${fieldArgs.modelApiId}`,
      };
    }
    fieldArgs.reverseField.modelApiId = fieldArgs.model;

    fieldArgs.isList =
      fieldArgs.relationType === RelationType.OneToMany ||
      fieldArgs.relationType === RelationType.ManyToMany;
    fieldArgs.reverseField.isList =
      fieldArgs.relationType === RelationType.ManyToOne ||
      fieldArgs.relationType === RelationType.ManyToMany;

    if (fieldArgs.type === "ASSET") {
      // assets needs the isRequired field
      if (fieldArgs.isRequired === undefined) {
        fieldArgs.isRequired = false;
      }
      // asset needs reverse field to be list
      fieldArgs.reverseField.isList = true;
      // asset needs reverse field to be hidden;
      fieldArgs.reverseField.isHidden = true;
    } else {
      // we have to drop them on relation fields:
      delete fieldArgs.isRequired;
    }

    // remove convenience fields
    delete fieldArgs.model;
    delete fieldArgs.relationType;

    const field = new Field(
      fieldArgs,
      MutationMode.Create,
      FieldType.RelationalField
    );
    this.listener.registerChange(field);
    return this;
  }

  addUnionField(fieldArgs: any): Model {
    fieldArgs.modelApiId = this.args.apiId;
    if (!fieldArgs.models || fieldArgs.models.length === 0) {
      throw new Error(`models cannot be empty`);
    }

    if (!fieldArgs.reverseField) {
      fieldArgs.reverseField = {
        apiId: `related${fieldArgs.modelApiId}`,
        displayName: `Related ${fieldArgs.modelApiId}`,
      };
    }
    fieldArgs.reverseField.modelApiIds = fieldArgs.models;

    fieldArgs.isList =
      fieldArgs.relationType === RelationType.OneToMany ||
      fieldArgs.relationType === RelationType.ManyToMany;
    fieldArgs.reverseField.isList =
      fieldArgs.relationType === RelationType.ManyToOne ||
      fieldArgs.relationType === RelationType.ManyToMany;

    // remove convenience fields
    delete fieldArgs.models;
    delete fieldArgs.relationType;

    const field = new Field(
      fieldArgs,
      MutationMode.Create,
      FieldType.UnionField
    );
    this.listener.registerChange(field);
    return this;
  }

  updateRelationalField(fieldArgs: any): Model {
    fieldArgs.modelApiId = this.args.apiId;

    const field = new Field(
      fieldArgs,
      MutationMode.Update,
      FieldType.RelationalField
    );
    this.listener.registerChange(field);
    return this;
  }

  updateUnionField(fieldArgs: any): Model {
    fieldArgs.modelApiId = this.args.apiId;
    fieldArgs.reverseField = {
      modelApiIds: fieldArgs.models,
    };

    // remove convenience field
    delete fieldArgs.models;

    const field = new Field(
      fieldArgs,
      MutationMode.Update,
      FieldType.UnionField
    );

    this.listener.registerChange(field);
    return this;
  }

  addEnumerableField(fieldArgs: any): Model {
    if (!fieldArgs.enumerationApiId) {
      throw new Error("enumerationApiId is required for enumerable field");
    }
    fieldArgs.modelApiId = this.args.apiId;
    const field = new Field(
      fieldArgs,
      MutationMode.Create,
      FieldType.EnumerableField
    );
    this.listener.registerChange(field);
    return this;
  }

  updateEnumerableField(fieldArgs: any): Model {
    fieldArgs.modelApiId = this.args.apiId;

    const field = new Field(
      fieldArgs,
      MutationMode.Update,
      FieldType.EnumerableField
    );
    this.listener.registerChange(field);
    return this;
  }

  deleteField(apiId: string): Model {
    const field = new Field(
      { apiId, modelApiId: this.args.apiId },
      MutationMode.Delete
    );
    this.listener.registerChange(field);
    return this;
  }

  hasChanges(): boolean {
    // all modes are guaranteed to have changes except Update.
    if (this.mode !== MutationMode.Update) {
      return true;
    }
    // apiId is always a requirement, length of 1 means its apiId only.
    if (Object.keys(this.args).length > 1) {
      return true;
    }
    return false;
  }

  generateChange(): MigrationChange {
    let action: string;
    switch (this.mode) {
      case MutationMode.Create:
        action = "createModel";
        break;
      case MutationMode.Update:
        action = "updateModel";
        break;
      case MutationMode.Delete:
        action = "deleteModel";
        break;
    }

    const change: { [key: string]: any } = {};
    change[action] = this.args;
    return change;
  }
}

/**
 * @ignore
 * @param fieldArgs
 */
function extractFieldValidations(
  fieldArgs: CreateSimpleFieldArgs
): GraphQLSimpleFieldValidationsInput {
  const validations: GraphQLSimpleFieldValidationsInput = {};
  switch (fieldArgs.type) {
    case GraphQLSimpleFieldType.Int:
      validations.Int = { range: fieldArgs.validations?.range };
      if (fieldArgs.isList) {
        validations.Int.listItemCount = fieldArgs.validations?.listItemCount;
      }
      break;

    case GraphQLSimpleFieldType.Float:
      validations.Float = { range: fieldArgs.validations?.range };
      if (fieldArgs.isList) {
        validations.Float.listItemCount = fieldArgs.validations?.listItemCount;
      }
      break;

    case GraphQLSimpleFieldType.String:
      validations.String = {
        characters: fieldArgs.validations?.characters,
        matches: fieldArgs.validations?.matches,
        notMatches: fieldArgs.validations?.notMatches,
      };
      if (fieldArgs.isList) {
        validations.String.listItemCount = fieldArgs.validations?.listItemCount;
      }
      break;

    default:
      throw new Error(`field validations not supported for ${fieldArgs.type}`);
  }

  return validations;
}

export { Model, ModelClass };
