/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Argv } from 'yargs';
import {
  CommandModuleImplementation,
  CommandScope,
  Options,
  OtherOptions,
} from '../../command-builder/command-module';
import {
  SchematicsCommandArgs,
  SchematicsCommandModule,
} from '../../command-builder/schematics-command-module';
import { ensureCompatibleNpm } from '../../utilities/package-manager';
import { VERSION } from '../../utilities/version';

interface NewCommandArgs extends SchematicsCommandArgs {
  collection?: string;
}

export class NewCommandModule
  extends SchematicsCommandModule
  implements CommandModuleImplementation<NewCommandArgs>
{
  private readonly schematicName = 'ng-new';
  static override scope = CommandScope.Out;
  protected override allowPrivateSchematics = true;

  command = 'new [name]';
  aliases = 'n';
  describe = 'Creates a new Angular workspace.';
  longDescriptionPath?: string | undefined;

  override async builder(argv: Argv): Promise<Argv<NewCommandArgs>> {
    const localYargs = (await super.builder(argv)).option('collection', {
      alias: 'c',
      describe: 'A collection of schematics to use in generating the initial application.',
      type: 'string',
    });

    const {
      options: { collectionNameFromArgs },
    } = this.context.args;

    const collectionName =
      typeof collectionNameFromArgs === 'string'
        ? collectionNameFromArgs
        : await this.getDefaultSchematicCollection();

    const workflow = await this.getOrCreateWorkflowForBuilder(collectionName);
    const collection = workflow.engine.createCollection(collectionName);
    const options = await this.getSchematicOptions(collection, this.schematicName, workflow);

    return this.addSchemaOptionsToCommand(localYargs, options);
  }

  async run(options: Options<NewCommandArgs> & OtherOptions): Promise<number | void> {
    // Register the version of the CLI in the registry.
    const collectionName = options.collection ?? (await this.getDefaultSchematicCollection());
    const workflow = await this.getOrCreateWorkflowForExecution(collectionName, options);
    workflow.registry.addSmartDefaultProvider('ng-cli-version', () => VERSION.full);

    const { dryRun, force, interactive, defaults, collection, ...schematicOptions } = options;

    // Compatibility check for NPM 7
    if (
      collectionName === '@schematics/angular' &&
      !schematicOptions.skipInstall &&
      (schematicOptions.packageManager === undefined || schematicOptions.packageManager === 'npm')
    ) {
      await ensureCompatibleNpm(this.context.root);
    }

    return this.runSchematic({
      collectionName,
      schematicName: this.schematicName,
      schematicOptions,
      executionOptions: {
        dryRun,
        force,
        interactive,
        defaults,
      },
    });
  }
}
