import {Module} from '@nestjs/common';
import {UsersModule} from './users/users.module';
import {AuthModule} from './auth/auth.module';
import {RoleModule} from './role/role.module';
import {TypeOrmModule} from "@nestjs/typeorm";
import {EmployeeModule} from './employee/employee.module';
import {BranchModule} from './branch/branch.module';
import {ServicesModule} from './services/services.module';
import {VisitsModule} from './visits/visits.module';
import {RankModule} from './rank/rank.module';
import {CommonModule} from './common/common.module';


import {User} from "./users/users.entity";
import {Visit} from "./visits/visit.entity";
import {Service} from "./services/services.entity";
import {Employee} from "./employee/employee.entity";
import {Branch} from "./branch/branch.entity";
import {Rank} from "./rank/rank.entity";

import {DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USERNAME} from "./config/config";


@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: DB_HOST,
            port: DB_PORT,
            username: DB_USERNAME,
            password: DB_PASSWORD,
            database: DB_NAME,
            entities: [
                User,
                Employee,
                Rank,
                Visit,
                Service,
                Branch,
            ],
            synchronize: true
        }),
        UsersModule,
        AuthModule,
        RoleModule,
        EmployeeModule,
        BranchModule,
        ServicesModule,
        VisitsModule,
        RankModule,
        CommonModule
    ],
})
export class AppModule {
}
