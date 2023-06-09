import {forwardRef, HttpException, HttpStatus, Inject, Injectable} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {Visit} from "../visit.entity";
import {Repository} from "typeorm";
import {CreateOrUpdateVisitDto, GetAllVisitsResultDto} from "../interfaces/visit.dto";
import {EmployeeService} from "employee/services/employee.service";
import {ServicesService} from "services/services/services.service";
import {IFindOneQuery} from "common/common.interface";
import {Service} from "services/services.entity";
import {CommonService} from "common/common.service";
import {EmployeeHelperService} from "employee/services/employee.helper.service";

@Injectable()
export class VisitsService {
    constructor(
        @InjectRepository(Visit)
        private readonly visitRepository: Repository<Visit>,
        private readonly servicesService: ServicesService,
        private readonly commonService: CommonService,
        @Inject(forwardRef(() => EmployeeService))
        private readonly employeeService: EmployeeService,
        private readonly employeeHelperService: EmployeeHelperService,
    ) {
    }

    getVisitEndDate(startDate: string, service: Service) {
        const start = new Date(startDate)
        start.setMinutes(start.getMinutes() + service.durationMin)
        return start.toISOString()
    }

    async findAll(query): Promise<GetAllVisitsResultDto> {
        const page: number = query.page || 1
        const take: number = query.take || 10
        const skip: number = (page - 1) * take


        const queryResult = await this.visitRepository.createQueryBuilder('visit')
            .leftJoinAndSelect('visit.employee', 'employee')
            .leftJoinAndSelect('visit.service', 'service')
            .orderBy('visit.startDate', 'DESC')
            .take(take)
            .skip(skip)
            .getManyAndCount()

        const [visitList, visitCount] = queryResult
        return {
            visitList,
            visitCount,
            pageSize: take
        }
    }

    async getAllVisitsByDate(employeeId: number, date: string): Promise<Visit[]> {
        const visits = await this.visitRepository.createQueryBuilder('visit')
            .leftJoinAndSelect('visit.employee', 'employee')
            .where(`DATE_TRUNC('day', visit.startDate) = :date`, {date})
            .andWhere('employee.id = :employeeId', {employeeId})

        return visits.getMany()
    }

    async create(data: CreateOrUpdateVisitDto): Promise<Visit> {
        const {fullName, phoneNumber, email, startDatetime, serviceId, employeeId} = data

        const employee = await this.employeeService.findOne({id: employeeId})
        const service = await this.servicesService.findOne({id: serviceId})

        const splitedDate = await this.commonService.getDateAndTimeFromDatetime(startDatetime)
        const visits = await this.getAllVisitsByDate(employeeId, splitedDate.date)

        const isEmployeeBusy = await this.employeeHelperService.isBusy(visits, splitedDate.time, service.durationMin)
        if (isEmployeeBusy) {
            throw new HttpException('Працівник зайнятий у цей час', HttpStatus.CONFLICT)
        }

        const endDate = this.getVisitEndDate(startDatetime, service)

        const visit = await this.visitRepository.create({
            fullName, phoneNumber, email, startDate: startDatetime, endDate, service, employee
        })

        await this.visitRepository.save(visit)
        return visit
    }

    async update(id: number, data: CreateOrUpdateVisitDto): Promise<Visit> {
        const {startDatetime, serviceId, employeeId, ...fields} = data
        const visit = await this.findOne({id})

        const service = await this.servicesService.findOne({id: serviceId})
        for (const [key, value] of Object.entries(fields)) {
            if (visit[key] !== value) {
                visit[key] = value
            }
        }
        if (visit.service.id !== serviceId) {
            visit.service = service
        }
        if (visit.employee.id !== employeeId) {
            visit.employee = await this.employeeService.findOne({id: serviceId})
        }
        if (new Date(visit.startDate).toISOString() !== new Date(startDatetime).toISOString()) {
            const splitedDate = await this.commonService.getDateAndTimeFromDatetime(startDatetime)

            const visits = await this.getAllVisitsByDate(employeeId, splitedDate.date)

            const isEmployeeBusy = await this.employeeHelperService.isBusy(visits, splitedDate.time, service.durationMin)
            if (isEmployeeBusy) {
                throw new HttpException('Працівник зайнятий у цей час', HttpStatus.CONFLICT)
            }

            visit.startDate = startDatetime
            visit.endDate = this.getVisitEndDate(startDatetime, service)
        }

        await this.visitRepository.save(visit)
        return visit
    }

    async delete(id: number) {
        const deleteResult = await this.visitRepository.createQueryBuilder('visit')
            .delete()
            .where('id = :id', {id})
            .execute()
        if (deleteResult.affected === 0) {
            throw new HttpException('Запис не знайдено', HttpStatus.NOT_FOUND) // visit not found
        }
    }

    async findOne(query: IFindOneQuery): Promise<Visit> {
        const visit = await this.visitRepository.findOne({
            where: query,
            relations: ['employee', 'service']
        })
        if (!visit) {
            throw new HttpException('Запис не знайдено', HttpStatus.NOT_FOUND) // visit not found
        }
        return visit
    }
}
