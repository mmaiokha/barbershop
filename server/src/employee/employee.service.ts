import {forwardRef, HttpException, HttpStatus, Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {Employee} from "./employee.entity";
import {InjectRepository} from "@nestjs/typeorm";
import {CreateOrUpdateEmployeeDto, EmployeeDto} from "./employee.dto";
import {BranchService} from "../branch/branch.service";
import {RankService} from "../rank/rank.service";
import {UsersService} from "../users/users.service";
import {FindOneQueryDto} from "../config/general.dto";
import {unlink} from "fs/promises";
import {VisitsService} from "../visits/visits.service";
import {Visit} from "../visits/visit.entity";
import {ServicesService} from "../services/services.service";

@Injectable()
export class EmployeeService {
    constructor(
        @InjectRepository(Employee)
        private readonly employeeRepository: Repository<Employee>,
        private readonly branchService: BranchService,
        private readonly rankService: RankService,
        private readonly usersService: UsersService,
        private readonly servicesService: ServicesService,
        @Inject(forwardRef(() => VisitsService))
        private readonly visitsService: VisitsService
    ) {
    }

    async create(data: CreateOrUpdateEmployeeDto, photo: Express.Multer.File | undefined): Promise<EmployeeDto> {
        const {
            firstName, lastName,
            phoneNumber, email,
            hiredFrom,
            branchId, rankId, userId
        } = data
        const empBranch = await this.branchService.findOne({id: branchId})
        const empRank = await this.rankService.findOne({id: rankId})
        const empUser = await this.usersService.findOne({id: userId})

        const createdEmployee = await this.employeeRepository.create({
            firstName, lastName,
            phoneNumber, email,
            hiredFrom,
            branch: empBranch,
            rank: empRank,
            user: empUser,
        })
        if (photo) {
            createdEmployee.photoUrl = photo.filename
        }
        createdEmployee.firedFrom = null
        await this.employeeRepository.save(createdEmployee)

        const {user, ...response} = createdEmployee
        return response
    }

    async findOne(query: FindOneQueryDto): Promise<Employee> {
        const employee = await this.employeeRepository.findOne({
            where: query,
            relations: ['rank', 'branch']
        })
        if (!employee) {
            throw new HttpException('Працівника не знайдено', HttpStatus.NOT_FOUND) // employee not found
        }
        return employee
    }

    async delete(id: number) {
        const deleteResult = await this.employeeRepository.createQueryBuilder('employee')
            .delete()
            .where('id - :id', {id})
            .execute()
        if (deleteResult.affected === 0) {
            throw new HttpException('Працівника не знайдено', HttpStatus.NOT_FOUND) // employee not found
        }
    }

    async update(id: number, data: CreateOrUpdateEmployeeDto, photo: Express.Multer.File | undefined) {
        const {branchId, rankId, ...fields} = data
        const employee = await this.findOne({id})

        if (branchId) {
            employee.branch = await this.branchService.findOne({id: branchId})
        }

        if (rankId) {
            employee.rank = await this.rankService.findOne({id: rankId})
        }

        for (const [key, value] of Object.entries(fields)) {
            if (employee[key] !== value) {
                employee[key] = value
            }
        }
        if (photo) {
            await unlink(`./files/employee/avatar/${employee.photoUrl}`)
            employee.photoUrl = photo.filename
        }

        await this.employeeRepository.save(employee)
        return employee
    }


    getTimeFromDate(date: string): string {
        const d = new Date(date)
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const seconds = d.getSeconds();
        const utcDate = new Date(year, month, day, hours, minutes, seconds);
        return `${String(utcDate.getHours()).padStart(2, '0')}:${String(utcDate.getMinutes()).padStart(2, '0')}:${String(utcDate.getSeconds()).padStart(2, '0')}`;
    }

    // increment time or/and convert to string
    incrementTime(time: string, incrementMinutes: number = 0): string {
        const [hours, minutes, seconds] = time.split(':')

        const incrementedTime = new Date();
        incrementedTime.setHours(Number(hours));
        incrementedTime.setMinutes(Number(minutes) + incrementMinutes);
        incrementedTime.setSeconds(Number(seconds));
        return `${String(incrementedTime.getHours()).padStart(2, '0')}:${String(incrementedTime.getMinutes()).padStart(2, '0')}:${String(incrementedTime.getSeconds()).padStart(2, '0')}`;
    }

    async getAvailableServicesForDate(employeeVisits: Visit[], time: string, employeeRankId: number) {
        const nextVisitTime: string = this.getTimeFromDate(employeeVisits.filter((visit) => {
            const visitStartString = this.getTimeFromDate(visit.startDate)
            return time < visitStartString
        })[0]?.startDate)
        const employeeServices = await this.servicesService.findAllByRankId(employeeRankId)

        return employeeServices.filter(service => {
            const serviceEndTime = this.incrementTime(time, service.durationMin)
            return serviceEndTime < nextVisitTime
        })
    }

    // return received time if employee free or create new if busy
    checkTime(employeeVisits: Visit[], time: string): string {
        const minVisitTime = 30
        const shiftTimeString = this.incrementTime(time, minVisitTime)

        // check employee visits
        for (const visit of employeeVisits) {
            const visitStartTime = this.getTimeFromDate(visit.startDate)
            const visitEndTime = this.getTimeFromDate(visit.endDate)

            if (time >= visitStartTime && time <= visitEndTime || shiftTimeString >= visitStartTime && shiftTimeString <= visitEndTime) {
                return this.incrementTime(visitEndTime, 15) // return new time if employee busy at this time
            }
        }
        return time // return received time if employee free
    }

    async getFreeVisits(id: number, date: string) {
        const employeeVisits = await this.visitsService.getAllVisitsByDate(id, date)
        const employee = await this.employeeRepository.findOne({
            where: {id},
            relations: ['branch', 'rank']
        })
        const response = []
        let startTime = employee.branch.openAt // get start time
        let endTime = employee.branch.closeAt // get end time

        const newDateShift = 40
        while (startTime < endTime) {
            const start = this.checkTime(employeeVisits, startTime) // return received time or changed
            const availableServices = await this.getAvailableServicesForDate(employeeVisits, start, employee.rank.id)
            response.push({start, availableServices})
            startTime = this.incrementTime(start, newDateShift) // set time for next iteration
        }

        return response
    }
}
