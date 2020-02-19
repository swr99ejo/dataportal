/* eslint-disable no-unused-vars */
import {Entity, Column, PrimaryColumn, OneToMany} from 'typeorm'
import {File} from './File'

@Entity()
export class Site {

    @PrimaryColumn()
    id!: string

    @Column()
    humanReadableName!: string

    @Column({type: 'float'})
    latitude!: number

    @Column({type: 'float'})
    longitude!: number

    @Column()
    elevation!: number

    @Column()
    gaw!: string

    @Column()
    country!: string

    @OneToMany(type => File, file => file.site)
    files!: File[];
}